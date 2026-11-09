import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { db, type SessionRow } from "@/lib/db";
import { isStale, type Turn } from "@/lib/debrief";
import { frDate, minutes as fmtMinutes } from "@/lib/format";
import type { Feedback } from "@/lib/prompts";
import { sessionSpec } from "@/lib/modes";
import type { Mission } from "@/lib/missions";
import MissionCard from "../../MissionCard";
import { Pending, Say } from "./client";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { used_alone: "✓ utilisé seule", used_with_help: "≈ avec aide", not_used: "○ pas encore" };

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(Number(id)) as SessionRow | undefined;
  if (!row) notFound();
  const spec = sessionSpec(row);

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
          <p className="eyebrow">Bilan · {spec?.title}</p>
          <h1>Ton bilan</h1>
        </div>
        <Pending id={row.id} initialStatus={status} initialError={row.debrief_error} hasTranscript={!!turns.length} />
        {transcript}
      </div>
    );
  }
  const fb = JSON.parse(row.feedback) as Feedback;
  const mission = db()
    .prepare("SELECT * FROM missions WHERE session_id = ? AND status = 'pending'")
    .get(row.id) as Mission | undefined;
  const canRedo = (fb.errors?.length ?? 0) + (fb.upgrades?.length ?? 0) > 0 && row.mode !== "review";

  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">{frDate(row.started_at)} · {fmtMinutes(row.duration_s)}</span>
      </header>
      <div>
        <p className="eyebrow">Bilan · {spec?.title}</p>
        <h1>¡Muy bien!</h1>
        <p>{fb.summary_fr}</p>
      </div>

      {fb.checkup?.level ? (
        <section className="card level-card">
          <p className="eyebrow">Ta carte de niveau · {frDate(row.started_at)}</p>
          <p className="level-big">{fb.checkup.level}</p>
          <p>{fb.checkup.comment_fr}</p>
          <p className="eyebrow">Je peux…</p>
          <ul>{fb.checkup.can_do_fr.map((c, i) => <li key={i}>{c}</li>)}</ul>
          <p className="eyebrow">Mes priorités du mois</p>
          <ul>{fb.checkup.focus_fr.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </section>
      ) : null}

      {fb.dele?.tasks?.length ? (
        <section className="card scorecard">
          <p className="eyebrow">Note indicative · {spec?.title}</p>
          <p><strong>{fb.dele.overall}</strong></p>
          <ul>
            {fb.dele.tasks.map((t) => {
              const sc = Math.max(0, Math.min(5, Math.round(t.score)));
              return (
                <li key={t.name}>
                  <span className="grow"><strong>{t.name}</strong><span className="muted small">{t.comment_fr}</span></span>
                  <span className="score">{"●".repeat(sc)}{"○".repeat(5 - sc)}</span>
                </li>
              );
            })}
          </ul>
          <p className="eyebrow">Pour le jour J</p>
          <ul>{fb.dele.advice_fr.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <p className="muted small">Simulation d'entraînement inspirée du format du DELE : la note est indicative, pas officielle.</p>
        </section>
      ) : null}

      {fb.interview?.criteria?.length ? (
        <section className="card scorecard">
          <p className="eyebrow">Note de l'entretien</p>
          {fb.interview.verdict_fr && <p><strong>{fb.interview.verdict_fr}</strong></p>}
          <ul>
            {fb.interview.criteria.map((c) => (
              <li key={c.name}>
                <span className="grow">
                  <strong>{c.name}</strong>
                  <span className="muted small">{c.comment_fr}</span>
                </span>
                <span className="score">
                  {"●".repeat(Math.max(0, Math.min(5, Math.round(c.score))))}
                  {"○".repeat(5 - Math.max(0, Math.min(5, Math.round(c.score))))}
                </span>
              </li>
            ))}
          </ul>
          {fb.interview.best_answer && (
            <p className="small"><strong>Ta meilleure réponse :</strong> {fb.interview.best_answer}</p>
          )}
          {fb.interview.to_improve?.model_answer && (
            <div className="card fix">
              <p className="eyebrow">À retravailler</p>
              <p className="small"><strong>Question :</strong> {fb.interview.to_improve.question}</p>
              <p className="said small">« {fb.interview.to_improve.her_answer} »</p>
              <p className="better">
                <Say text={fb.interview.to_improve.model_answer} /> {fb.interview.to_improve.model_answer}
              </p>
            </div>
          )}
        </section>
      ) : null}

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

      {mission && (
        <MissionCard mission={mission} next={`/feedback/${row.id}`} />
      )}

      {!!fb.learner_facts?.length && (
        <section className="card">
          <p className="eyebrow">Carla a retenu</p>
          <ul>{fb.learner_facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
          <Link href="/profil#memoire" className="link small">Voir ou corriger sa mémoire ›</Link>
        </section>
      )}

      {transcript}

      <div className="controls">
        {canRedo && (
          <Link className="primary big" href={`/pratique/refaire?from=${row.id}`}>
            🎙️ Redire mes corrections avec Carla (5 min)
          </Link>
        )}
        {spec?.scenarioId && <Link className="secondary" href={`/session/${spec.scenarioId}`}>Refaire toute la séance</Link>}
        <Link className={canRedo ? "secondary" : "primary"} href="/">Terminé</Link>
      </div>
    </div>
  );
}
