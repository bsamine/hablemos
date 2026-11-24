"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AudioIO } from "@/lib/audio";
import { Say } from "./feedback/[id]/client";
import type { StartRequest } from "@/lib/modes";
import type { TargetWord } from "@/lib/scenarios";

type Turn = { role: "learner" | "tutor"; text: string };
type Phase = "ready" | "connecting" | "live" | "reconnecting" | "ending" | "error";
type StartResponse = {
  sessionId: number;
  token: string;
  model: string;
  apiVersion: string;
  voice: string;
  minutes: number;
  learnerName: string;
};

export type Preview = {
  title: string;
  taskGoal: string;
  words: TargetWord[];
  wordsLabel?: string;
  image?: string;
  minutes?: number;
};

/** Prepared sessions stay usable for 20 minutes (the token lives 30). */
const PREPARED_TTL = 20 * 60_000;
/** Save the transcript to the server at least this often while live. */
const SAVE_EVERY_MS = 20_000;
/** Automatic reconnections in a row before asking the learner to tap "Reprendre". */
const MAX_AUTO_RECONNECTS = 2;

/** Send a browser-side problem to the server log (it reaches the n8n alert). Never throws. */
function report(where: string, message: string, detail?: unknown) {
  try {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ where, message, detail }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* reporting must never break the session */
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

export default function Conversation({ preview, start }: { preview: Preview; start: StartRequest }) {
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
  const savedCountRef = useRef(0);
  const savedAtRef = useRef(0);
  const autoReconnectsRef = useRef(0);
  const genRef = useRef(0); // which connection is current: callbacks from older ones are ignored
  const reconnectingRef = useRef(false);
  const closedGenRef = useRef(-1); // last connection Gemini closed
  const closeInfoRef = useRef("");
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const usageRef = useRef({ input: 0, output: 0, inputAudio: 0, outputAudio: 0 });
  const timeUpSentRef = useRef(false);

  function payload() {
    return JSON.stringify({
      transcript: turnsRef.current,
      durationS: (Date.now() - startedAtRef.current) / 1000,
      usage: usageRef.current,
    });
  }

  /** Save the transcript so far. `beacon` is for when the page is being hidden or closed. */
  function saveProgress(beacon = false) {
    const id = startRef.current?.sessionId;
    if (!id || endingRef.current || !startedAtRef.current) return;
    const count = turnsRef.current.length;
    if (!count) return;
    savedCountRef.current = count;
    savedAtRef.current = Date.now();
    const url = `/api/sessions/${id}/progress`;
    if (beacon && navigator.sendBeacon?.(url, new Blob([payload()], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload(), keepalive: true }).catch(
      (e) => console.warn("progress save failed", e),
    );
  }

  async function keepAwake() {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (wl && !wakeLockRef.current) wakeLockRef.current = await wl.request("screen");
    } catch (e) {
      console.warn("wake lock unavailable", e); // older iOS: the screen may lock, the transcript is saved anyway
    }
  }

  function releaseAwake() {
    const w = wakeLockRef.current;
    wakeLockRef.current = null;
    void w?.release().catch(() => undefined);
  }

  // Save regularly while live.
  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") return;
    const t = setInterval(() => {
      if (turnsRef.current.length !== savedCountRef.current || Date.now() - savedAtRef.current > 60_000) saveProgress();
    }, SAVE_EVERY_MS);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phone locked, app switched, tab closed: save now. Back on screen: keep the screen awake again.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        saveProgress(true);
        wakeLockRef.current = null; // the system releases it when hidden
      } else if (sessionRef.current) void keepAwake();
    };
    const onPageHide = () => saveProgress(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "live" && phase !== "reconnecting") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Time is up: Carla wraps up by herself (once), the learner can still continue.
  useEffect(() => {
    if (phase === "live" && elapsed >= limit && !timeUpSentRef.current && sessionRef.current) {
      timeUpSentRef.current = true;
      sessionRef.current.sendRealtimeInput({ text: "[TIEMPO]" });
    }
  }, [elapsed, limit, phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => () => void cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prepare the session (Carla's prompt + Live token) while she reads the intro: tapping "Commencer" then only connects.
  const preparedRef = useRef<{ at: number; p: Promise<{ ok: boolean; data: StartResponse & { error?: string } }> } | null>(null);
  function prepare() {
    preparedRef.current = {
      at: Date.now(),
      p: fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(start),
      }).then(async (res) => ({ ok: res.ok, data: await res.json() })),
    };
    preparedRef.current.p.catch(() => {});
  }
  useEffect(() => {
    prepare();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addText(role: Turn["role"], text: string) {
    if (!text) return;
    const list = turnsRef.current;
    const last = list[list.length - 1];
    if (last && last.role === role) last.text += text;
    else list.push({ role, text });
    turnsRef.current = list;
    setTurns(list.map((t) => ({ ...t })));
    // A new turn started: save every few turns, not on every word.
    if (list.length - savedCountRef.current >= 4) saveProgress();
  }

  function onMessage(msg: LiveServerMessage) {
    const sc = msg.serverContent;
    if (msg.usageMetadata) addUsage(msg.usageMetadata);
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
    if (msg.goAway) void reconnect("goAway");
    if (sc?.turnComplete) autoReconnectsRef.current = 0; // the conversation is flowing again
  }

  /** Gemini reports tokens per turn: add them up (an estimate, shown on the Suivi page). */
  function addUsage(u: NonNullable<LiveServerMessage["usageMetadata"]>) {
    const audio = (d?: { modality?: string; tokenCount?: number }[]) =>
      (d ?? []).filter((x) => String(x.modality ?? "").toUpperCase() === "AUDIO").reduce((n, x) => n + (x.tokenCount ?? 0), 0);
    const input = u.promptTokenCount ?? 0;
    const output = (u.responseTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || Math.max(0, (u.totalTokenCount ?? 0) - input);
    const t = usageRef.current;
    t.input += input;
    t.output += output;
    t.inputAudio += Math.min(input, audio(u.promptTokensDetails));
    t.outputAudio += Math.min(output, audio(u.responseTokensDetails));
  }

  async function connect(start: StartResponse) {
    const gen = ++genRef.current;
    const ai = new GoogleGenAI({ apiKey: start.token, httpOptions: { apiVersion: start.apiVersion } });
    const session = await ai.live.connect({
      model: start.model,
      // Carla's setup (prompt, voice, transcription) is locked into the token by the server.
      // Only the resumption handle comes from the browser, to resume after a disconnect.
      config: {
        responseModalities: [Modality.AUDIO],
        sessionResumption: handleRef.current ? { handle: handleRef.current } : {},
      },
      callbacks: {
        onmessage: (m) => {
          if (gen === genRef.current) onMessage(m);
        },
        onerror: (e) => console.error("live error", e),
        onclose: (e) => {
          if (gen !== genRef.current) return; // an older connection we closed ourselves
          closedGenRef.current = gen;
          closeInfoRef.current = `code ${e?.code ?? "?"} : ${e?.reason || "sans raison"}`;
          sessionRef.current = null;
          console.warn("live close", e?.code, e?.reason);
          if (endingRef.current) return;
          const early = Date.now() - connectedAtRef.current < 8000 || !gotAudioRef.current;
          if (early && !turnsRef.current.length) {
            // Closed before the conversation really started: a config/model problem, not a network blip.
            const msg = `Gemini a fermé la connexion (code ${e?.code ?? "?"}) : ${e?.reason || "sans raison"}`;
            report("live-close-early", msg, { model: start.model });
            setError(msg);
            setPhase("error");
            return;
          }
          void reconnect(e?.reason);
        },
      },
    });
    if (closedGenRef.current === gen || gen !== genRef.current) {
      // Closed (or replaced) before we even got it: don't keep a dead session.
      try {
        session.close();
      } catch {
        /* already closed */
      }
      throw new Error(`Gemini a fermé la connexion à l'ouverture (${closeInfoRef.current || "remplacée"})`);
    }
    sessionRef.current = session;
    connectedAtRef.current = Date.now();
    return session;
  }

  /** The last exchanges, so Carla can pick up where she was when the session can't be resumed. */
  function recap(): string {
    return turnsRef.current
      .slice(-6)
      .map((t) => `${t.role === "learner" ? "Alumna" : "Carla"}: ${t.text.trim()}`)
      .join("\n");
  }

  /**
   * Reconnect after a drop. Gemini's resumption handle keeps the conversation; without one (or if it
   * fails), a fresh connection is opened and Carla gets the last exchanges to continue naturally.
   * `byUser` is a tap on "Reprendre": it may also need to restart the microphone (iOS takes it away).
   */
  async function reconnect(reason?: string, byUser = false) {
    if (endingRef.current || !startRef.current || reconnectingRef.current) return;
    if (!byUser && ++autoReconnectsRef.current > MAX_AUTO_RECONNECTS) {
      report("live-reconnect", "Trop de coupures", { reason });
      setError("La connexion est instable. Appuie sur « Reprendre » quand tu es prête, ou termine pour voir ton bilan.");
      setPhase("error");
      return;
    }
    reconnectingRef.current = true;
    setPhase("reconnecting");
    setError("");
    genRef.current++; // from here on, the old connection's close/messages are ignored
    try {
      sessionRef.current?.close();
    } catch {
      /* already closed */
    }
    sessionRef.current = null;
    try {
      if (byUser) await ensureAudio();
      let fresh = !handleRef.current;
      let session: Session;
      try {
        session = await connect(startRef.current);
      } catch (e) {
        if (fresh) throw e;
        console.warn("resume with handle failed, starting fresh", e);
        handleRef.current = null;
        fresh = true;
        session = await connect(startRef.current);
      }
      if (fresh) {
        // A fresh connection has no memory of the conversation: give Carla the thread.
        const lines = recap();
        const name = startRef.current.learnerName;
        session.sendRealtimeInput({
          text: `[RECONEXIÓN]${name ? ` Alumna: ${name}.` : ""}${lines ? `\n${lines}` : ""}`,
        });
      }
      setPhase("live");
      void keepAwake();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report("live-reconnect", msg, { reason });
      setError(`Impossible de reprendre la conversation (${msg}). Réessaie, ou termine pour voir ton bilan : rien n'est perdu.`);
      setPhase("error");
    } finally {
      reconnectingRef.current = false;
    }
  }

  /** After a phone call or the app going to background, iOS may have suspended audio or taken the mic. */
  async function ensureAudio() {
    const audio = audioRef.current;
    if (audio && audio.micAlive() && audio.ctx.state !== "closed") {
      await audio.ctx.resume();
      return;
    }
    await audio?.close();
    const fresh = new AudioIO();
    fresh.onLevel = setTutorSpeaking;
    fresh.muted = muted;
    audioRef.current = fresh;
    await fresh.ctx.resume();
    await fresh.start(sendChunk);
  }

  function sendChunk(b64: string) {
    sessionRef.current?.sendRealtimeInput({ audio: { data: b64, mimeType: "audio/pcm;rate=16000" } });
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
      await audio.start(sendChunk);

      if (!preparedRef.current || Date.now() - preparedRef.current.at > PREPARED_TTL) prepare();
      const prepared = preparedRef.current!;
      preparedRef.current = null; // one use: a retry prepares a fresh session
      const { ok, data } = await prepared.p;
      if (!ok) throw new Error(data.error ?? "Erreur serveur");
      startRef.current = data as StartResponse;
      setLimit(data.minutes * 60);

      await connect(data);
      startedAtRef.current = Date.now();
      setPhase("live");
      void keepAwake();
      // A private signal defined in Carla's prompt: nothing here may be read aloud.
      sessionRef.current?.sendRealtimeInput({ text: `[INICIO]${data.learnerName ? ` Alumna: ${data.learnerName}.` : ""}` });
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
      report("start", `${name ? name + ": " : ""}${msg}`);
      setPhase("error");
      await cleanup();
    }
  }

  async function cleanup() {
    releaseAwake();
    genRef.current++;
    try {
      sessionRef.current?.close();
    } catch {
      /* already closed */
    }
    sessionRef.current = null;
    await audioRef.current?.close();
    audioRef.current = null;
  }

  async function finish() {
    endingRef.current = true;
    setPhase("ending");
    setError("");
    await cleanup();
    const id = startRef.current?.sessionId;
    if (!id) return router.push("/");
    try {
      const res = await fetch(`/api/sessions/${id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload(),
      });
      if (res.ok) return router.push(`/feedback/${id}`);
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report("end", msg, { sessionId: id });
      // The transcript stays in memory (and was saved along the way): she can simply tap again.
      setError("Le bilan n'a pas pu être envoyé (connexion ?). Ta conversation est gardée : réessaie dans un instant.");
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
        {preview.image && <img src={preview.image} alt="La scène à décrire" className="scene" />}
        <section className="card carla-intro">
          <img src="/carla.svg" alt="" className="avatar" />
          <div>
            <p className="eyebrow">Avec Carla</p>
            <p>{preview.taskGoal}</p>
          </div>
        </section>
        {preview.words.length > 0 && (
          <section className="card">
            <p className="eyebrow">{preview.wordsLabel ?? "Les mots du jour"}</p>
            <ul className="words">
              {preview.words.map((w) => (
                <li key={w.word}>
<Say text={w.example ? `${w.word}. ${w.example}` : w.word} lang="es" />
                  <div>
                    <strong>{w.word}</strong> <span className="muted">— {w.fr}</span>
                    {w.example && <div className="example">{w.example}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="muted small">Conseil : avec des écouteurs, Carla t'entend mieux. Dis « fin de la sesión » pour terminer{preview.minutes ? ` · environ ${preview.minutes} min` : ""}.</p>
        {error && <p className="error">{error}</p>}
        <button className="primary big" onClick={begin}>
          🎙️ Commencer avec Carla
        </button>
      </div>
    );
  }

  return (
    <div className="stack conversation">
      <div className="status">
        <span className={`avatar-live ${tutorSpeaking ? "speaking" : muted ? "muted-dot" : "listening"}`}>
          <img src="/carla.svg" alt="Carla" />
        </span>
        <span>
          {phase === "connecting" && "Connexion…"}
          {phase === "reconnecting" && "Reconnexion…"}
          {phase === "live" && (tutorSpeaking ? "Carla parle" : muted ? "Micro coupé" : "Carla t'écoute")}
          {phase === "ending" && "Carla prépare ton bilan…"}
          {phase === "error" && "Problème de connexion"}
        </span>
        <span className="timer">{mm(elapsed)}</span>
      </div>

      {elapsed >= limit && live && (
        <p className="notice">C'est l'heure ! Dis « fin de la sesión » ou appuie sur Terminer.</p>
      )}

      {preview.image && <img src={preview.image} alt="La scène à décrire" className="scene" />}

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
          <button onClick={() => ask("[AYUDA: repite tu última frase más despacio]")}>🐢 Plus lentement</button>
          <button onClick={() => ask("[AYUDA: explícale tu última frase en francés, con acento francés]")}>🇫🇷 En français</button>
          <button onClick={() => ask("[AYUDA: repite tu última frase]")}>🔁 Répète</button>
          <button onClick={() => setCaptions((c) => !c)}>{captions ? "Masquer" : "Afficher"} sous-titres</button>
        </div>
      )}

      <div className="controls">
        {live && (
          <button className={`secondary ${muted ? "on" : ""}`} onClick={toggleMute}>
            {muted ? "🔇 Réactiver le micro" : "🎙️ Couper le micro"}
          </button>
        )}
        {phase === "error" && !endingRef.current && (
          <button className="secondary" onClick={() => void reconnect("user", true)}>
            🔄 Reprendre la conversation
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
