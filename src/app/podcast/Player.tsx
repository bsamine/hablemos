"use client";

import { useEffect, useRef, useState } from "react";
import type { Podcast } from "@/lib/generate";

const SPEEDS = [
  { v: 0.75, label: "Lente" },
  { v: 0.9, label: "Normale" },
  { v: 1.1, label: "Rapide" },
];

/** Carla reads the episode (server TTS, cached). Speed changes apply instantly, mid-sentence. */
export default function Player({ podcast, day }: { podcast: Podcast; day: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [rate, setRate] = useState(0.9);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const [showText, setShowText] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(podcast.questions.map(() => null));

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.preservesPitch = true;
    a.addEventListener("playing", () => setState("playing"));
    a.addEventListener("pause", () => setState((s) => (s === "loading" ? s : "paused")));
    a.addEventListener("waiting", () => setState("loading"));
    a.addEventListener("ended", () => setState("paused"));
    a.addEventListener("error", () => setState("error"));
    a.addEventListener("timeupdate", () => setPos({ t: a.currentTime, d: a.duration || 0 }));
    audio.current = a;
    return () => a.pause();
  }, []);

  function setSpeed(v: number) {
    setRate(v);
    if (audio.current) audio.current.playbackRate = v; // instant, no pause needed
  }

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (state === "playing") return a.pause();
    if (!a.src) a.src = `/api/tts/podcast?d=${day}`;
    a.playbackRate = rate;
    setState("loading");
    a.play().catch(() => setState("error"));
  }

  function seek(delta: number) {
    const a = audio.current;
    if (a && a.duration) a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + delta));
  }

  const fmt = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
  const score = answers.filter((a, i) => a === podcast.questions[i].answer).length;
  const finished = answers.every((a) => a !== null);

  return (
    <div className="stack">
      <section className="card hero">
        <div className="carla-intro">
          <img src="/carla.svg" alt="" className="avatar small-avatar" />
          <div>
            <p className="eyebrow">Carla lit</p>
            <h2>{podcast.title_es}</h2>
          </div>
        </div>
        <div className="row">
          <button className="primary" onClick={toggle} disabled={state === "loading"}>
            {state === "playing" ? "⏸ Pause" : state === "loading" ? "Carla se prépare…" : "▶ Écouter Carla"}
          </button>
          <button className="secondary" onClick={() => seek(-10)} disabled={!pos.d}>↺ 10 s</button>
        </div>
        {pos.d > 0 && (
          <div className="progress-line">
            <span style={{ width: `${(pos.t / pos.d) * 100}%` }} />
          </div>
        )}
        {pos.d > 0 && <p className="muted small">{fmt(pos.t)} / {fmt(pos.d)}</p>}
        <div className="speeds" role="group" aria-label="Vitesse">
          {SPEEDS.map((sp) => (
            <button key={sp.v} className={rate === sp.v ? "on" : ""} onClick={() => setSpeed(sp.v)}>
              {sp.label}
            </button>
          ))}
        </div>
        {state === "error" && <p className="error small">La voix de Carla n'est pas disponible pour le moment. Réessaie dans un instant.</p>}
        <button className="link small" onClick={() => setShowText((s) => !s)}>{showText ? "Masquer le texte" : "Lire le texte"}</button>
        {showText && <p className="podcast-text">{podcast.text_es}</p>}
      </section>
      <section className="card">
        <p className="eyebrow">Mots du jour</p>
        <ul className="words">
          {podcast.glossary.map((g, i) => (
            <li key={i}><div><strong>{g.es}</strong> <span className="muted">— {g.fr}</span></div></li>
          ))}
        </ul>
      </section>
      <section className="stack">
        <h3>As-tu compris ?</h3>
        {podcast.questions.map((q, i) => (
          <div key={i} className="card stack">
            <strong>{q.q_es}</strong>
            {q.options.map((o, j) => {
              const picked = answers[i] === j;
              const state = answers[i] === null ? "" : j === q.answer ? "right" : picked ? "wrong" : "";
              return (
                <button
                  key={j}
                  className={`option ${state}`}
                  disabled={answers[i] !== null}
                  onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
                >
                  {o}
                </button>
              );
            })}
          </div>
        ))}
        {finished && <p className="card good">{score}/{podcast.questions.length} — {score === podcast.questions.length ? "¡Perfecto!" : "¡Muy bien! Réécoute pour trouver le reste."}</p>}
      </section>
    </div>
  );
}
