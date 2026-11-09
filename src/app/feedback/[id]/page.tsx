import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db, type SessionRow } from "@/lib/db";
import { isStale, type Turn } from "@/lib/debrief";
import { frDate, minutes as fmtMinutes } from "@/lib/format";
import type { Feedback } from "@/lib/prompts";
import { getScenario } from "@/lib/scenarios";
import { Pending, Say } from "./client";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { used_alone: "✓ utilisé seule", used_with_help: "≈ avec aide", not_used: "○ pas encore" };

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(Number(id)) as SessionRow | undefined;
  if (!row) notFound();
  const scenario = getScenario(row.scenario_id);

  const turns: Turn[] = row.transcript ? JSON.parse(row.transcript) : [];
  const transcript = turns.length ? (
    <details className="card">
      <summary>Relire la conversation ({turns.length} échanges)</summary>
      <div className="captions transcript">
        {turns.map((t, i) => (
          <p key={i} className={`bubble ${t.role}`}>{t.text}</p>
        ))}
      </div>
    </details>
  ) : null;

  if (!row.feedback) {
    const status = isStale(row) ? "stale" : (row.debrief_status ?? "none");
    return (
      <div className="stack">
        <header className="top">
          <Link href="/" className="link">‹ Accueil</Link>
          <span className="muted small">{frDate(row.started_at)}</span>
        </header>
        <div>
          <p className="eyebrow">Bilan · {scenario?.title}</p>
          <h1>Ton bilan</h1>
        </div>
        <Pending id={row.id} initialStatus={status} initialError={row.debrief_error} hasTranscript={!!turns.length} />
        {transcript}
      </div>
    );
  }
  const fb = JSON.parse(row.feedback) as Feedback;

  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">{frDate(row.started_at)} · {fmtMinutes(row.duration_s)}</span>
      </header>
      <div>
        <p className="eyebrow">Bilan · {scenario?.title}</p>
        <h1>¡Muy bien!</h1>
        <p>{fb.summary_fr}</p>
      </div>

      {!!fb.strengths_fr?.length && (
        <section className="card good">
          <p className="eyebrow">Tes points forts</p>
          <ul>{fb.strengths_fr.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>
      )}

      {!!fb.errors?.length && (
        <section className="stack">
          <h3>À corriger</h3>
          {fb.errors.map((e, i) => (
            <div className="card fix" key={i}>
              <p className="said">« {e.learner_said} »</p>
              <p className="better">
                <Say text={e.correction} /> {e.correction}
              </p>
              <p className="muted">{e.rule_fr}</p>
              <p className="drill">
                <Say text={e.drill} /> À répéter : <em>{e.drill}</em>
              </p>
            </div>
          ))}
        </section>
      )}

      {!!fb.upgrades?.length && (
        <section className="stack">
          <h3>Dis-le plus naturellement</h3>
          {fb.upgrades.map((u, i) => (
            <div className="card" key={i}>
              <p className="said">« {u.learner_said} »</p>
              <p className="better"><Say text={u.better} /> {u.better}</p>
              <p className="muted">{u.why_fr}</p>
            </div>
          ))}
        </section>
      )}

      {!!fb.words?.length && (
        <section className="card">
          <p className="eyebrow">Mots de la séance</p>
          <ul className="words">
            {fb.words.map((w, i) => (
              <li key={i}>
                <Say text={w.word} />
                <div>
                  <strong>{w.word}</strong> <span className="muted">— {w.translation_fr}</span>
                  <div className="small">{STATUS[w.status] ?? w.status}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!fb.new_words?.length && (
        <section className="card">
          <p className="eyebrow">Nouveaux mots ajoutés à ta liste</p>
          <ul className="words">
            {fb.new_words.map((w, i) => (
              <li key={i}>
                <Say text={w.word} />
                <div><strong>{w.word}</strong> <span className="muted">— {w.translation_fr}</span></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fb.tomorrow_challenge && (
        <section className="card hero">
          <p className="eyebrow">Défi pour demain</p>
          <p><Say text={fb.tomorrow_challenge} /> {fb.tomorrow_challenge}</p>
        </section>
      )}

      {transcript}

      <div className="controls">
        {scenario && <Link className="secondary" href={`/session/${scenario.id}`}>Refaire cette séance</Link>}
        <Link className="primary" href="/">Terminé</Link>
      </div>
    </div>
  );
}
