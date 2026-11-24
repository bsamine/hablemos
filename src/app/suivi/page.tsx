import Link from "next/link";
import { activityReport } from "@/lib/activity";
import { requireAuth } from "@/lib/auth";
import { LENGTH_LABELS, type SessionLength } from "@/lib/modes";
import { dailyUsage, fmtEur, fmtTokens, usageSummary } from "@/lib/usage";
import TabBar from "../TabBar";
import UsageCard from "../UsageCard";

export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = {
  scenario: "Leçon",
  random: "Conversation au hasard",
  redo: "Redire mes corrections",
  review: "Révision express",
};

/** How the app is really used, and what it costs. */
export default async function Suivi() {
  await requireAuth();
  const u = usageSummary();
  const days = dailyUsage(14);
  const a = activityReport(30);
  const maxMin = Math.max(1, ...days.map((d) => d.minutes));
  const maxHour = Math.max(1, ...a.byHour);
  const totalStarted = a.modes.reduce((n, m) => n + m.started, 0);
  const totalFinished = a.modes.reduce((n, m) => n + m.finished, 0);

  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/profil" className="link">‹ Profil</Link>
      </header>
      <div>
        <p className="eyebrow">Suivi</p>
        <h1>Usage et consommation</h1>
        <p className="muted small">Sur les 30 derniers jours : {a.activeDays} jour{a.activeDays > 1 ? "s" : ""} d'utilisation, {totalStarted} séance{totalStarted > 1 ? "s" : ""} commencée{totalStarted > 1 ? "s" : ""}, {totalFinished} avec bilan.</p>
      </div>

      <UsageCard link={false} />

      <section className="card">
        <p className="eyebrow">Minutes parlées · 14 jours</p>
        <div className="bars days14">
          {days.map((d) => (
            <div key={d.day} className="bar-col" title={`${d.sessions} séance(s) · ${fmtTokens(d.tokens)} tokens · ${fmtEur(d.costEur)}`}>
              <span className="bar-val">{d.minutes || ""}</span>
              <span className="bar" style={{ height: `${(d.minutes / maxMin) * 100}%` }} />
              <span className="bar-label">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
        <table className="table">
          <thead>
            <tr><th>Jour</th><th>Séances</th><th>Min</th><th>Tokens</th><th>Coût</th></tr>
          </thead>
          <tbody>
            {[...days].reverse().filter((d) => d.sessions || d.tokens).map((d) => (
              <tr key={d.day}>
                <td>{new Date(`${d.day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                <td>{d.sessions}</td>
                <td>{d.minutes}</td>
                <td>{fmtTokens(d.tokens)}</td>
                <td>{fmtEur(d.costEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!days.some((d) => d.sessions || d.tokens) && <p className="muted small">Pas encore d'activité.</p>}
      </section>

      <section className="card">
        <p className="eyebrow">Ce mois-ci, par usage</p>
        <ul className="list-plain">
          {u.byKind.map((k) => (
            <li key={k.kind}>
              <span className="grow">{k.label}<span className="muted small">{k.calls} appel{k.calls > 1 ? "s" : ""} · {fmtTokens(k.tokens)} tokens</span></span>
              <strong>{fmtEur(k.costEur)}</strong>
            </li>
          ))}
          {!u.byKind.length && <li className="muted small">Rien ce mois-ci.</li>}
        </ul>
      </section>

      <section className="card">
        <p className="eyebrow">Séances par type · 30 jours</p>
        <ul className="list-plain">
          {a.modes.map((m) => (
            <li key={`${m.mode}-${m.length}`}>
              <span className="grow">
                {MODE_LABELS[m.mode] ?? m.mode}
                {m.length && <span className="muted small">{LENGTH_LABELS[m.length as SessionLength] ?? m.length}</span>}
              </span>
              <span className="muted small">{m.finished}/{m.started} terminées · {Math.round(m.seconds / 60)} min</span>
            </li>
          ))}
          {!a.modes.length && <li className="muted small">Pas encore de séance.</li>}
        </ul>
      </section>

      <section className="card">
        <p className="eyebrow">À quelle heure elle pratique</p>
        <div className="hours">
          {a.byHour.map((n, h) => (
            <span key={h} className="hour" style={{ opacity: n ? 0.25 + (0.75 * n) / maxHour : 0.08 }} title={`${h} h : ${n}`}>
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Pages les plus ouvertes · 30 jours</p>
        <ul className="list-plain">
          {a.pages.map((p) => (
            <li key={p.label}><span className="grow">{p.label}</span><span className="muted small">{p.n}</span></li>
          ))}
          {!a.pages.length && <li className="muted small">Pas encore de visite enregistrée.</li>}
        </ul>
        <p className="muted small">
          ▶ écoutés : {a.counts.play ?? 0} · séances abandonnées : {a.counts.session_abandoned ?? 0}
        </p>
      </section>
      <TabBar active="" />
    </div>
  );
}
