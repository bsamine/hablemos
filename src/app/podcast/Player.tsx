"use client";

import { useState } from "react";
import type { Podcast } from "@/lib/generate";

/** Reads the episode with the device's Spanish voice; text, glossary and quiz on demand. */
export default function Player({ podcast }: { podcast: Podcast }) {
  const [rate, setRate] = useState(0.85);
  const [playing, setPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(podcast.questions.map(() => null));

  function play() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(podcast.text_es);
    u.lang = "es-ES";
    u.rate = rate;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang === "es-ES");
    if (v) u.voice = v;
    u.onend = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(u);
  }
  function stop() {
    window.speechSynthesis.cancel();
    setPlaying(false);
  }
  const score = answers.filter((a, i) => a === podcast.questions[i].answer).length;
  const finished = answers.every((a) => a !== null);

  return (
    <div className="stack">
      <section className="card hero">
        <h2>{podcast.title_es}</h2>
        <div className="row">
          <button className="primary" onClick={playing ? stop : play}>{playing ? "⏸ Arrêter" : "▶ Écouter"}</button>
          <label className="small row">
            Vitesse
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              <option value={0.7}>lente</option>
              <option value={0.85}>normale</option>
              <option value={1}>rapide</option>
            </select>
          </label>
        </div>
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
