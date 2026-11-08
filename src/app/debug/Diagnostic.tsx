"use client";

import { GoogleGenAI, Modality, type LiveConnectConfig, type LiveServerMessage } from "@google/genai";
import { useState } from "react";

type Variant = { name: string; apiVersion: string; model: string; config: LiveConnectConfig };
type Result = { name: string; status: string; detail: string; ms: number };

const SYS = "Tu es Lucía, professeure d'espagnol. Réponds en espagnol en une phrase courte.";

export default function Diagnostic({ model, apiVersion, voice }: { model: string; apiVersion: string; voice: string }) {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  const full: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: SYS,
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: {},
    contextWindowCompression: { slidingWindow: {} },
  };
  const minimal: LiveConnectConfig = { responseModalities: [Modality.AUDIO] };
  const without = (k: keyof LiveConnectConfig): LiveConnectConfig => {
    const c = { ...full };
    delete c[k];
    return c;
  };
  const other = apiVersion === "v1alpha" ? "v1beta" : "v1alpha";

  const variants: Variant[] = [
    { name: `App config · ${apiVersion}`, apiVersion, model, config: full },
    { name: `App config · ${other}`, apiVersion: other, model, config: full },
    { name: `Minimal · ${apiVersion}`, apiVersion, model, config: minimal },
    { name: `Minimal · ${other}`, apiVersion: other, model, config: minimal },
    { name: "Sans contextWindowCompression", apiVersion, model, config: without("contextWindowCompression") },
    { name: "Sans sessionResumption", apiVersion, model, config: without("sessionResumption") },
    { name: "Sans voix (speechConfig)", apiVersion, model, config: without("speechConfig") },
    { name: "Sans transcriptions", apiVersion, model, config: { ...without("inputAudioTranscription"), outputAudioTranscription: undefined } },
    { name: "Modèle gemini-2.5-flash-native-audio-latest", apiVersion, model: "gemini-2.5-flash-native-audio-latest", config: full },
  ];

  async function runOne(v: Variant): Promise<Result> {
    const t0 = Date.now();
    const done = (status: string, detail: string): Result => ({ name: v.name, status, detail, ms: Date.now() - t0 });
    const res = await fetch("/api/debug/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiVersion: v.apiVersion, model: v.model }),
    });
    const data = await res.json();
    if (!res.ok) return done("✗ token", data.error ?? String(res.status));

    return new Promise<Result>((resolve) => {
      const seen = new Set<string>();
      let finished = false;
      let session: { close: () => void; sendRealtimeInput: (p: { text: string }) => void } | null = null;
      const finish = (r: Result) => {
        if (finished) return;
        finished = true;
        try {
          session?.close();
        } catch {}
        resolve(r);
      };
      const timer = setTimeout(() => finish(done("? timeout", `10 s sans audio · messages: ${[...seen].join(", ") || "aucun"}`)), 10_000);
      const ai = new GoogleGenAI({ apiKey: data.token, httpOptions: { apiVersion: v.apiVersion } });
      ai.live
        .connect({
          model: v.model,
          config: v.config,
          callbacks: {
            onmessage: (m: LiveServerMessage) => {
              for (const k of Object.keys(m)) if ((m as unknown as Record<string, unknown>)[k] != null) seen.add(k);
              const audio = m.serverContent?.modelTurn?.parts?.some((p) => p.inlineData?.mimeType?.startsWith("audio/"));
              if (audio) {
                clearTimeout(timer);
                finish(done("✓ OK", `audio reçu · messages: ${[...seen].join(", ")}`));
              }
            },
            onerror: (e) => {
              clearTimeout(timer);
              finish(done("✗ erreur", (e as ErrorEvent)?.message || "websocket error"));
            },
            onclose: (e) => {
              clearTimeout(timer);
              finish(done("✗ fermé", `code ${e?.code} ${e?.reason || "(sans raison)"} · messages: ${[...seen].join(", ") || "aucun"}`));
            },
          },
        })
        .then((s) => {
          session = s;
          s.sendRealtimeInput({ text: "Hola, ¿cómo estás?" });
        })
        .catch((e) => {
          clearTimeout(timer);
          finish(done("✗ connect", e instanceof Error ? e.message : String(e)));
        });
    });
  }

  async function runAll() {
    setRunning(true);
    setResults([]);
    const out: Result[] = [];
    for (const v of variants) {
      out.push(await runOne(v));
      setResults([...out]);
    }
    setRunning(false);
  }

  return (
    <div className="stack">
      <h1>Diagnostic Gemini Live</h1>
      <p className="muted small">
        Modèle {model} · API {apiVersion} · voix {voice}. Chaque test envoie « Hola » en texte (pas de micro) et attend une réponse audio.
      </p>
      <button className="primary big" onClick={runAll} disabled={running}>
        {running ? `Test ${results.length + 1}/${variants.length}…` : "Lancer le diagnostic"}
      </button>
      <ul className="list">
        {results.map((r) => (
          <li key={r.name} className="card">
            <strong>
              {r.status} — {r.name}
            </strong>
            <span className="small muted">
              {r.detail} · {r.ms} ms
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
