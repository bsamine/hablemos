import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { frDate } from "@/lib/format";
import { stats } from "@/lib/learning";
import { getProfile } from "@/lib/profile";
import { progress } from "@/lib/progress";
import { ERROR_LABELS } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export default async function Progres() {
  await requireAuth();
  const p = progress();
  const s = stats();
  const profile = getProfile();
  const maxMin = Math.max(15, ...p.weeks.map((w) => w.minutes));
  const totalWords = p.words.fresh + p.words.learning + p.words.mastered;
  const pct = (n: number) => (totalWords ? `${(n / totalWords) * 100}%` : "0%");

  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">Niveau {profile.level}</span>
      </header>
      <h1>Mes progrès</h1>

      <section className="stats">
        <div><strong>{p.totals.sessions}</strong><span>séances</span></div>
        <div><strong>{p.totals.minutes}</strong><span>minutes parlées</span></div>
        <div><strong>{s.streak}</strong><span>jours d'affilée</span></div>
      </section>

      <section className="card">
        <p className="eyebrow">Minutes parlées par semaine</p>
        <div className="bars">
          {p.weeks.map((w) => (
            <div key={w.label} className="bar-col" title={`${w.sessions} séance(s)`}>
              <span className="bar-val">{w.minutes || ""}</span>
              <span className="bar" style={{ height: `${(w.minutes / maxMin) * 100}%` }} />
              <span className="bar-label">{w.label}</span>
            </div>
          ))}
        </div>
        <p className="muted small">Objectif : 15 minutes par jour, soit environ 100 minutes par semaine.</p>
      </section>

      <section className="card">
        <p className="eyebrow">Mes mots ({totalWords})</p>
        <div className="stack-bar">
          <span className="seg mastered" style={{ width: pct(p.words.mastered) }} />
          <span className="seg learning" style={{ width: pct(p.words.learning) }} />
          <span className="seg fresh" style={{ width: pct(p.words.fresh) }} />
        </div>
        <ul className="legend">
          <li><span className="seg mastered" /> Maîtrisés · {p.words.mastered}</li>
          <li><span className="seg learning" /> En cours · {p.words.learning}</li>
          <li><span className="seg fresh" /> Nouveaux · {p.words.fresh}</li>
        </ul>
        <Link href="/mots" className="link small">Voir tous mes mots ›</Link>
      </section>

      <section className="card">
        <p className="eyebrow">Mes erreurs : 14 derniers jours (avant)</p>
        {p.errors.length ? (
          <ul className="errors-trend">
            {p.errors.map((e) => (
              <li key={e.category}>
                <span className="grow">{ERROR_LABELS[e.category] ?? e.category}</span>
                <strong>{e.recent}</strong>
                <span className="muted small">({e.before})</span>
                <span className={e.recent < e.before ? "good-text" : e.recent > e.before ? "error" : "muted"}>
                  {e.recent < e.before ? "▼" : e.recent > e.before ? "▲" : "="}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Pas encore assez de séances.</p>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Niveau estimé par séance</p>
        {p.levels.length ? (
          <ul className="levels">
            {p.levels.map((l, i) => (
              <li key={i}>
                <span className={`chip lvl-${l.level}`}>{l.level}</span>
                <span className="muted small">{frDate(l.date)} · confiance {l.confidence === "high" ? "haute" : l.confidence === "medium" ? "moyenne" : "faible"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Apparaîtra après ta première séance.</p>
        )}
      </section>
    </div>
  );
}
