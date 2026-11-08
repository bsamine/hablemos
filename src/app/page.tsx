import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { doneScenarioIds, stats } from "@/lib/learning";
import { SCENARIOS } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAuth();
  const s = stats();
  const done = doneScenarioIds();
  const next = SCENARIOS.find((x) => !done.has(x.id)) ?? SCENARIOS[0];

  return (
    <div className="stack">
      <header className="top">
        <h1 className="logo">¡Hablemos!</h1>
        <form action="/api/logout" method="post">
          <button className="link" type="submit">Sortir</button>
        </form>
      </header>

      <section className="stats">
        <div><strong>{s.streak}</strong><span>jours d'affilée</span></div>
        <div><strong>{s.minutes}</strong><span>minutes parlées</span></div>
        <Link href="/mots"><strong>{s.words}</strong><span>mots · {s.due} à revoir</span></Link>
      </section>

      <Link href={`/session/${next.id}`} className="card hero">
        <p className="eyebrow">Séance du jour · Jour {next.day}</p>
        <h2>{next.title}</h2>
        <p className="muted">{next.titleFr}</p>
        <span className="primary pill">Parler avec Lucía →</span>
      </Link>

      <h3>Toutes les séances</h3>
      <ul className="list">
        {SCENARIOS.map((x) => (
          <li key={x.id}>
            <Link href={`/session/${x.id}`}>
              <span className="day">{done.has(x.id) ? "✓" : x.day}</span>
              <span className="grow">
                <strong>{x.title}</strong>
                <span className="muted small">{x.theme} · {x.titleFr}</span>
              </span>
              <span className="muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
