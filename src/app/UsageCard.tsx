import Link from "next/link";
import { fmtEur, fmtTokens, usageSummary } from "@/lib/usage";

/** Gemini consumption at a glance (profile page). */
export default function UsageCard({ link = true }: { link?: boolean }) {
  const u = usageSummary();
  const pct = u.budgetEur > 0 ? Math.min(100, Math.round((u.month.costEur / u.budgetEur) * 100)) : 0;
  return (
    <section className="card stack usage-card">
      <div className="top">
        <p className="eyebrow">Consommation Gemini</p>
        {link && <Link href="/suivi" className="link small">Suivi détaillé ›</Link>}
      </div>
      <div className="kpis">
        <div><strong>{fmtEur(u.today.costEur)}</strong><span>aujourd'hui · {fmtTokens(u.today.tokens)} tokens</span></div>
        <div><strong>{fmtEur(u.week.costEur)}</strong><span>7 jours · {fmtTokens(u.week.tokens)}</span></div>
        <div><strong>{fmtEur(u.month.costEur)}</strong><span>ce mois · {fmtTokens(u.month.tokens)}</span></div>
      </div>
      <div>
        <div className="progress-line budget"><span style={{ width: `${pct}%` }} className={pct >= 80 ? "warn" : ""} /></div>
        <p className="muted small">{pct} % du budget mensuel ({u.budgetEur} €) · estimation à partir des tarifs configurés</p>
      </div>
    </section>
  );
}
