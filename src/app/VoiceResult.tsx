"use client";

import { speakEs } from "@/lib/audio";
import type { DebriefResult, DiaryResult, MissingResult, PronunciationResult } from "@/lib/voice-handlers";

function Play({ text }: { text: string }) {
  return (
    <button className="play" onClick={() => speakEs(text)} aria-label="Écouter">
      ▶
    </button>
  );
}

/** Renders the analysed result of a voice note, by kind. */
export default function VoiceResult({ kind, result }: { kind: string; result: unknown }) {
  if (!result) return null;
  if (kind === "missing") {
    const r = result as MissingResult;
    return (
      <div className="stack">
        {r.items?.map((it, i) => (
          <div key={i} className="card fix">
            <p className="muted small">Tu voulais dire : {it.intent_fr}</p>
            <p className="better"><Play text={it.es} /> {it.es}</p>
            <p className="small">{it.explanation_fr}</p>
            {it.example_es && <p className="example">{it.example_es}</p>}
          </div>
        ))}
        {r.encouragement_fr && <p className="muted">{r.encouragement_fr}</p>}
        <p className="muted small">Ces phrases sont ajoutées à tes mots : Carla les fera revenir.</p>
      </div>
    );
  }
  if (kind === "debrief") {
    const r = result as DebriefResult;
    return (
      <div className="stack">
        <p>{r.summary_fr}</p>
        {!!r.went_well_fr?.length && (
          <div className="card good">
            <p className="eyebrow">Ce qui a marché</p>
            <ul>{r.went_well_fr.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {!!r.missing?.length && (
          <div className="card fix">
            <p className="eyebrow">Ce qui t'a manqué</p>
            {r.missing.map((m, i) => (
              <p key={i} className="better">
                <Play text={m.es} /> <span>{m.es} <span className="muted small">— {m.intent_fr}</span></span>
              </p>
            ))}
          </div>
        )}
        {r.next_step_fr && <p><strong>Prochaine étape :</strong> {r.next_step_fr}</p>}
      </div>
    );
  }
  if (kind === "diary") {
    const r = result as DiaryResult;
    return (
      <div className="stack">
        <div className="carla-intro">
          <img src="/carla.svg" alt="" className="avatar small-avatar" />
          <p className="better"><Play text={r.reply_es} /> {r.reply_es}</p>
        </div>
        {r.corrections?.map((c, i) => (
          <div key={i} className="card fix">
            <p className="said">« {c.said} »</p>
            <p className="better"><Play text={c.better} /> {c.better}</p>
            <p className="muted small">{c.why_fr}</p>
          </div>
        ))}
        {r.question_es && (
          <p className="card">
            <span className="eyebrow">Pour demain</span>
            <br />
            <Play text={r.question_es} /> {r.question_es}
          </p>
        )}
      </div>
    );
  }
  if (kind === "pronunciation") {
    const r = result as PronunciationResult;
    const s = Math.max(0, Math.min(5, Math.round(r.score)));
    return (
      <div className="stack">
        <p>
          <span className="score">{"●".repeat(s)}{"○".repeat(5 - s)}</span> <strong>{s}/5</strong>
        </p>
        <p className="pron-words">
          {r.words?.map((w, i) => (
            <span key={i} className={w.ok ? "ok" : "ko"} title={w.tip_fr}>
              {w.word}{" "}
            </span>
          ))}
        </p>
        {r.words?.filter((w) => !w.ok && w.tip_fr).map((w, i) => (
          <p key={i} className="small"><strong>{w.word}</strong> : {w.tip_fr}</p>
        ))}
        {r.tip_fr && <p className="muted">{r.tip_fr}</p>}
        <p className="muted small">Entendu : « {r.transcript} »</p>
      </div>
    );
  }
  return null;
}
