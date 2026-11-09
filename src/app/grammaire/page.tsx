import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCache } from "@/lib/cache";
import { db } from "@/lib/db";
import type { GrammarCard } from "@/lib/generate";
import { getProfile } from "@/lib/profile";
import { ERROR_LABELS } from "@/lib/prompts";
import { Say } from "../feedback/[id]/client";
import GenerateButton from "../GenerateButton";
import TabBar from "../TabBar";

export const dynamic = "force-dynamic";

const DEFAULTS = ["ser_estar", "verb_conjugation", "gustar", "gender_agreement"];

export default async function Grammaire() {
  await requireAuth();
  const { level } = getProfile();
  const counted = db()
    .prepare("SELECT category, COUNT(*) AS n FROM errors WHERE category <> 'other' GROUP BY category ORDER BY n DESC")
    .all() as { category: string; n: number }[];
  const cats = [...new Set([...counted.map((c) => c.category), ...DEFAULTS])].filter((c) => ERROR_LABELS[c]);
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/lecons" className="link">‹ Leçons</Link>
      </header>
      <div>
        <h1>📐 Mes fiches de grammaire</h1>
        <p className="muted">Une fiche d'une minute pour chaque erreur qui revient, avec tes vraies phrases. Les plus fréquentes en premier.</p>
      </div>
      {cats.map((cat) => {
        const card = getCache<GrammarCard>(`grammar:${cat}:${level}`);
        const n = counted.find((c) => c.category === cat)?.n ?? 0;
        return (
          <section key={cat} id={cat} className="card stack">
            <div className="top">
              <strong>{ERROR_LABELS[cat]}</strong>
              <span className="muted small">{n ? `${n} erreur${n > 1 ? "s" : ""}` : "à connaître"}</span>
            </div>
            {card ? (
              <>
                <h3>{card.title_fr}</h3>
                <p>{card.rule_fr}</p>
                <ul className="words">
                  {card.examples.map((e, i) => (
                    <li key={i}>
                      <Say text={e.es} />
                      <div><strong>{e.es}</strong><div className="muted small">{e.fr}</div></div>
                    </li>
                  ))}
                </ul>
                <p className="small">⚠️ {card.pitfall_fr}</p>
                <p className="eyebrow">À dire à voix haute</p>
                <ul className="words">
                  {card.drill_es.map((d, i) => (
                    <li key={i}><Say text={d} /> <span>{d}</span></li>
                  ))}
                </ul>
              </>
            ) : (
              <GenerateButton url={`/api/generate/grammar?cat=${cat}`} label="Voir la fiche" variant="secondary" busyLabel="Carla écrit la fiche…" />
            )}
          </section>
        );
      })}
      <TabBar active="lecons" />
    </div>
  );
}
