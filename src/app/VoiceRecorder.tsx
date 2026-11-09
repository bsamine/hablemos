"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import VoiceResult from "./VoiceResult";

type Phase = "idle" | "recording" | "uploading" | "analysing" | "done" | "error";

/** Tap to record a short voice note (16 kHz WAV), upload it, then show Carla's analysis. */
export default function VoiceRecorder({
  kind,
  refId = "",
  label = "Enregistrer",
  hint,
  maxSeconds = 90,
  compact = false,
}: {
  kind: "missing" | "debrief" | "diary" | "pronunciation";
  refId?: string;
  label?: string;
  hint?: string;
  maxSeconds?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [noteId, setNoteId] = useState<number | null>(null);
  const chunks = useRef<Int16Array[]>([]);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => void stopRef.current(), []);

  useEffect(() => {
    if (phase !== "analysing" || !noteId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/voice/${noteId}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { status: string; error: string | null; result: unknown };
      if (d.status === "done") {
        setResult(d.result);
        setPhase("done");
        router.refresh();
      } else if (d.status === "error") {
        setError(d.error ?? "L'analyse a échoué.");
        setPhase("error");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [phase, noteId, router]);

  async function start() {
    setError("");
    setResult(null);
    chunks.current = [];
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      await ctx.audioWorklet.addModule("/pcm-recorder.js");
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "pcm-recorder");
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => chunks.current.push(new Int16Array(e.data));
      const sink = ctx.createGain();
      sink.gain.value = 0;
      src.connect(node);
      node.connect(sink).connect(ctx.destination);
      stopRef.current = async () => {
        if (timer.current) clearInterval(timer.current);
        node.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        try {
          await ctx.close();
        } catch {}
      };
      setSeconds(0);
      setPhase("recording");
      const t0 = Date.now();
      timer.current = setInterval(() => {
        const s = Math.round((Date.now() - t0) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) void stop();
      }, 250);
    } catch (e) {
      const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
      setError(/NotAllowed|Permission/i.test(msg) ? "Le micro est bloqué : autorise-le pour ce site." : msg);
      setPhase("error");
    }
  }

  async function stop() {
    await stopRef.current();
    stopRef.current = async () => {};
    setPhase("uploading");
    const wav = toWav(chunks.current, 16000);
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("ref", refId);
    fd.append("audio", wav, "note.wav");
    const res = await fetch("/api/voice", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Envoi impossible.");
      setPhase("error");
      return;
    }
    setNoteId(d.id);
    setPhase("analysing");
  }

  async function retry() {
    if (!noteId) return start();
    setError("");
    await fetch(`/api/voice/${noteId}`, { method: "POST" });
    setPhase("analysing");
  }

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className={`recorder ${compact ? "compact" : ""}`}>
      {hint && phase === "idle" && <p className="muted small">{hint}</p>}
      {(phase === "idle" || phase === "done") && (
        <button className={compact ? "secondary" : "primary big"} onClick={start}>
          🎙️ {phase === "done" ? "Recommencer" : label}
        </button>
      )}
      {phase === "recording" && (
        <button className="primary big recording" onClick={stop}>
          ⏹ Terminer · {mm} / {Math.floor(maxSeconds / 60)}:{String(maxSeconds % 60).padStart(2, "0")}
        </button>
      )}
      {(phase === "uploading" || phase === "analysing") && (
        <div className="status">
          <span className="dot speaking" />
          <span>{phase === "uploading" ? "Envoi…" : "Carla écoute ton enregistrement…"}</span>
        </div>
      )}
      {phase === "error" && (
        <div className="stack">
          <p className="error small">{error}</p>
          <button className="secondary" onClick={noteId ? retry : start}>
            {noteId ? "Relancer l'analyse" : "Réessayer"}
          </button>
        </div>
      )}
      {phase === "done" && <VoiceResult kind={kind} result={result} />}
    </div>
  );
}

function toWav(parts: Int16Array[], rate: number): Blob {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const buf = new ArrayBuffer(44 + len * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + len * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, len * 2, true);
  let o = 44;
  for (const p of parts) for (let i = 0; i < p.length; i++, o += 2) v.setInt16(o, p[i], true);
  return new Blob([buf], { type: "audio/wav" });
}
