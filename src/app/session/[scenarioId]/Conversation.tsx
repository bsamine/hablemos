"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AudioIO, speakEs } from "@/lib/audio";
import type { Scenario } from "@/lib/scenarios";

type Turn = { role: "learner" | "tutor"; text: string };
type Phase = "ready" | "connecting" | "live" | "reconnecting" | "ending" | "error";
type StartResponse = {
  sessionId: number;
  token: string;
  model: string;
  apiVersion: string;
  voice: string;
  minutes: number;
  systemInstruction: string;
};

export default function Conversation({ scenario }: { scenario: Scenario }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(15 * 60);

  const turnsRef = useRef<Turn[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<AudioIO | null>(null);
  const startRef = useRef<StartResponse | null>(null);
  const handleRef = useRef<string | null>(null);
  const endingRef = useRef(false);
  const startedAtRef = useRef(0);
  const connectedAtRef = useRef(0);
  const gotAudioRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => () => void cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function addText(role: Turn["role"], text: string) {
    if (!text) return;
    const list = turnsRef.current;
    const last = list[list.length - 1];
    if (last && last.role === role) last.text += text;
    else list.push({ role, text });
    turnsRef.current = list;
    setTurns(list.map((t) => ({ ...t })));
  }

  function onMessage(msg: LiveServerMessage) {
    const sc = msg.serverContent;
    if (sc?.interrupted) audioRef.current?.stopPlayback();
    for (const part of sc?.modelTurn?.parts ?? []) {
      const d = part.inlineData;
      if (d?.data && d.mimeType?.startsWith("audio/")) {
        gotAudioRef.current = true;
        const rate = Number(/rate=(\d+)/.exec(d.mimeType)?.[1] ?? 24000);
        audioRef.current?.play(d.data, rate);
      }
    }
    if (sc?.inputTranscription?.text) addText("learner", sc.inputTranscription.text);
    if (sc?.outputTranscription?.text) addText("tutor", sc.outputTranscription.text);
    const upd = msg.sessionResumptionUpdate;
    if (upd?.resumable && upd.newHandle) handleRef.current = upd.newHandle;
    if (msg.goAway) void reconnect();
  }

  async function connect(start: StartResponse) {
    const ai = new GoogleGenAI({ apiKey: start.token, httpOptions: { apiVersion: start.apiVersion } });
    const session = await ai.live.connect({
      model: start.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: start.systemInstruction,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: start.voice } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: handleRef.current ? { handle: handleRef.current } : {},
        contextWindowCompression: { slidingWindow: {} },
      },
      callbacks: {
        onmessage: onMessage,
        onerror: (e) => console.error("live error", e),
        onclose: (e) => {
          sessionRef.current = null;
          console.warn("live close", e?.code, e?.reason);
          if (endingRef.current) return;
          const early = Date.now() - connectedAtRef.current < 8000 || !gotAudioRef.current;
          if (early) {
            // Closed before the conversation really started: a config/model problem, not a network blip.
            setError(`Gemini a fermé la connexion (code ${e?.code ?? "?"}) : ${e?.reason || "sans raison"}`);
            setPhase("error");
            return;
          }
          void reconnect(e?.reason);
        },
      },
    });
    sessionRef.current = session;
    connectedAtRef.current = Date.now();
    return session;
  }

  async function reconnect(reason?: string) {
    if (endingRef.current || !startRef.current) return;
    if (!handleRef.current) {
      setError(reason ? `Connexion interrompue (${reason}).` : "Connexion interrompue.");
      setPhase("error");
      return;
    }
    setPhase("reconnecting");
    try {
      sessionRef.current?.close();
    } catch {}
    try {
      await connect(startRef.current);
      setPhase("live");
    } catch (e) {
      console.error(e);
      setError(`Impossible de reprendre la conversation : ${e instanceof Error ? e.message : String(e)}`);
      setPhase("error");
    }
  }

  async function begin() {
    setPhase("connecting");
    setError("");
    endingRef.current = false;
    try {
      const audio = new AudioIO();
      audio.onLevel = setTutorSpeaking;
      audioRef.current = audio;
      await audio.ctx.resume(); // must happen inside the tap on iPhone
      // Microphone first: a mic problem shows up clearly and doesn't burn a Gemini token.
      // Chunks are dropped until the Gemini session exists.
      await audio.start((b64) =>
        sessionRef.current?.sendRealtimeInput({ audio: { data: b64, mimeType: "audio/pcm;rate=16000" } }),
      );

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      startRef.current = data as StartResponse;
      setLimit(data.minutes * 60);

      await connect(data);
      startedAtRef.current = Date.now();
      setPhase("live");
      sessionRef.current?.sendRealtimeInput({
        text: `(La séance commence. Présente-toi : tu es Lucía. Annonce le thème du jour : « ${scenario.title} ».)`,
      });
    } catch (e) {
      console.error(e);
      endingRef.current = true; // our own cleanup must not be reported as a Gemini close
      const name = e instanceof Error ? e.name : "";
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /NotAllowed|Permission/i.test(name + msg)
          ? "Le micro est bloqué. Autorise le micro pour ce site (icône à gauche de l'adresse, ou Réglages > Safari sur iPhone)."
          : /NotFound|DevicesNotFound/i.test(name + msg)
            ? "Aucun micro trouvé. Branche ou active un micro puis réessaie."
            : /NotReadable|TrackStart/i.test(name + msg)
              ? "Le micro est utilisé par une autre application (Zoom, Teams, Notion…). Ferme-la puis réessaie."
              : `Erreur au démarrage : ${name ? name + " — " : ""}${msg}`,
      );
      setPhase("error");
      await cleanup();
    }
  }

  async function cleanup() {
    try {
      sessionRef.current?.close();
    } catch {}
    sessionRef.current = null;
    await audioRef.current?.close();
    audioRef.current = null;
  }

  async function finish() {
    endingRef.current = true;
    setPhase("ending");
    await cleanup();
    const id = startRef.current?.sessionId;
    if (!id) return router.push("/");
    const res = await fetch(`/api/sessions/${id}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: turnsRef.current, durationS: (Date.now() - startedAtRef.current) / 1000 }),
    });
    if (res.ok) router.push(`/feedback/${id}`);
    else {
      const data = await res.json().catch(() => ({}));
      // The transcript is saved: the feedback page has a "Créer le bilan" retry button.
      if (res.status === 502) return router.push(`/feedback/${id}?e=${encodeURIComponent(data.error ?? "")}`);
      setError(data.error ?? "Le bilan n'a pas pu être créé.");
      setPhase("error");
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (next) sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
  }

  function ask(text: string) {
    audioRef.current?.stopPlayback();
    sessionRef.current?.sendRealtimeInput({ text });
  }

  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const live = phase === "live" || phase === "reconnecting";

  if (phase === "ready" || (phase === "error" && !startRef.current)) {
    return (
      <div className="stack">
        <section className="card">
          <p className="eyebrow">Tâche du jour</p>
          <p>{scenario.taskGoal}</p>
        </section>
        <section className="card">
          <p className="eyebrow">Les 5 mots du jour</p>
          <ul className="words">
            {scenario.words.map((w) => (
              <li key={w.word}>
                <button className="play" onClick={() => speakEs(`${w.word}. ${w.example}`)} aria-label={`Écouter ${w.word}`}>
                  ▶
                </button>
                <div>
                  <strong>{w.word}</strong> <span className="muted">— {w.fr}</span>
                  <div className="example">{w.example}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p className="muted small">Conseil : avec des écouteurs, Lucía t'entend mieux. Dis « fin de la sesión » pour terminer.</p>
        {error && <p className="error">{error}</p>}
        <button className="primary big" onClick={begin}>
          🎙️ Commencer avec Lucía
        </button>
      </div>
    );
  }

  return (
    <div className="stack conversation">
      <div className="status">
        <span className={`dot ${tutorSpeaking ? "speaking" : muted ? "muted-dot" : "listening"}`} />
        <span>
          {phase === "connecting" && "Connexion…"}
          {phase === "reconnecting" && "Reconnexion…"}
          {phase === "live" && (tutorSpeaking ? "Lucía parle" : muted ? "Micro coupé" : "Lucía t'écoute")}
          {phase === "ending" && "Lucía prépare ton bilan…"}
          {phase === "error" && "Problème de connexion"}
        </span>
        <span className="timer">{mm(elapsed)}</span>
      </div>

      {elapsed >= limit && live && (
        <p className="notice">C'est l'heure ! Dis « fin de la sesión » ou appuie sur Terminer.</p>
      )}

      <div className={`captions ${captions ? "" : "hidden-captions"}`} ref={scrollRef}>
        {captions ? (
          turns.length ? (
            turns.map((t, i) => (
              <p key={i} className={`bubble ${t.role}`}>
                {t.text}
              </p>
            ))
          ) : (
            <p className="muted small">Les sous-titres s'affichent ici.</p>
          )
        ) : (
          <p className="muted small">Sous-titres masqués : entraîne ton oreille !</p>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {live && (
        <div className="helpers">
          <button onClick={() => ask("Parle plus lentement, s'il te plaît.")}>🐢 Plus lentement</button>
          <button onClick={() => ask("Explique-moi ça en français, s'il te plaît.")}>🇫🇷 En français</button>
          <button onClick={() => setCaptions((c) => !c)}>{captions ? "Masquer" : "Afficher"} sous-titres</button>
        </div>
      )}

      <div className="controls">
        {live && (
          <button className={`secondary ${muted ? "on" : ""}`} onClick={toggleMute}>
            {muted ? "🔇 Réactiver le micro" : "🎙️ Couper le micro"}
          </button>
        )}
        {phase !== "ending" && (
          <button className="primary" onClick={finish} disabled={phase === "connecting"}>
            Terminer et voir le bilan
          </button>
        )}
      </div>
    </div>
  );
}
