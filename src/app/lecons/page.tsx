import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { history } from "@/lib/history";
import { doneScenarioIds, stats } from "@/lib/learning";
import { getProfile } from "@/lib/profile";
import { LESSONS } from "@/lib/scenarios";
import HistoryList from "../HistoryList";
import TabBar from "../TabBar";

export const dynamic = "force-dynamic";

export default async function Lecons() {
  await requireAuth();
  const s = stats();
  const done = doneScenarioIds();
  const { level } = getProfile();
  const themes = [...new Set(LESSONS.map((x) => x.theme))];
  const firstOpen = LESSONS.find((x) => !done.has(x.id))?.theme;
  const past = history({ modes: ["scenario", "redo", "review", "shadowing"], limit: 5 });

  return (
    <div className="stack with-tabbar">
      <header className="area-header">
        <span className="area-icon">📚</span>
        <div>
          <h1>Leçons</h1>
          <p className="muted small">Apprendre pas à pas avec Carla · niveau {level}</p>
        </div>
      </header>

      <section className="quick">
        <Link href="/pratique/revision" className={`card ${s.due ? "" : "dim"}`}>
          <strong>⚡ Révision express</strong>
          <span className="muted small">{s.due ? `${Math.min(s.due, 8)} mots · 4 min` : "Rien à revoir aujourd'hui"}</span>
        </Link>
        <Link href="/pratique/shadowing" className="card">
          <strong>🗣️ Shadowing</strong>
          <span className="muted small">Répéter après Carla · 5 min</span>
        </Link>
      </section>

      {themes.map((theme) => (
        <details key={theme} className="theme-group" open={theme === firstOpen}>
          <summary>
            {theme}{" "}
            <span className="muted small">
              {LESSONS.filter((x) => x.theme === theme && done.has(x.id)).length}/{LESSONS.filter((x) => x.theme === theme).length}
            </span>
          </summary>
          <ul className="list">
            {LESSONS.filter((x) => x.theme === theme).map((x) => (
              <li key={x.id}>
                <Link href={`/session/${x.id}`}>
                  <span className={`day ${done.has(x.id) ? "done" : ""}`}>{done.has(x.id) ? "✓" : x.level}</span>
                  <span className="grow">
                    <strong>{x.title}</strong>
                    <span className="muted small">{x.titleFr}</span>
                  </span>
                  <span className="muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}

      {past.length > 0 && (
        <>
          <h3>Bilans des leçons</h3>
          <HistoryList items={past} />
        </>
      )}
      <TabBar active="lecons" />
    </div>
  );
}
