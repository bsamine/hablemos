import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { frDate } from "@/lib/format";
import { history } from "@/lib/history";
import type { Feedback } from "@/lib/prompts";
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
  const past = history({ modes: ["scenario", "redo", "review", "shadowing", "story", "picture", "checkup"], limit: 5 });
  const episodes = (db().prepare("SELECT COUNT(*) AS n FROM sessions WHERE mode = 'story' AND feedback IS NOT NULL").get() as { n: number }).n;
  const lastCheck = db()
    .prepare("SELECT id, started_at, feedback FROM sessions WHERE mode = 'checkup' AND feedback IS NOT NULL ORDER BY started_at DESC LIMIT 1")
    .get() as { id: number; started_at: string; feedback: string } | undefined;
  const lastLevel = lastCheck ? (JSON.parse(lastCheck.feedback) as Feedback).checkup?.level : null;
  const checkDue = !lastCheck || Date.now() - Date.parse(lastCheck.started_at) > 28 * 86400_000;

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

      <h3>S'entraîner autrement</h3>
      <section className="quick">
        <Link href="/journal" className="card">
          <strong>🎧 Journal vocal</strong>
          <span className="muted small">1 min par jour, Carla répond</span>
        </Link>
        <Link href="/podcast" className="card">
          <strong>📻 Podcast du jour</strong>
          <span className="muted small">2 min d'écoute + quiz</span>
        </Link>
        <Link href="/pratique/histoire" className="card">
          <strong>🎬 Telenovela</strong>
          <span className="muted small">Épisode {episodes + 1} · tu es l'héroïne</span>
        </Link>
        <Link href="/pratique/image" className="card">
          <strong>🖼️ Décrire l'image</strong>
          <span className="muted small">Une scène de Madrid · 7 min</span>
        </Link>
        <Link href="/prononciation" className="card">
          <strong>🎯 Prononciation</strong>
          <span className="muted small">Une note par mot</span>
        </Link>
        <Link href="/grammaire" className="card">
          <strong>📐 Fiches de grammaire</strong>
          <span className="muted small">Tes erreurs expliquées</span>
        </Link>
      </section>

      <Link href="/pratique/bilan" className={`card area ${checkDue ? "mission" : ""}`}>
        <span className="area-icon">🏅</span>
        <span className="grow">
          <strong>Bilan de niveau du mois</strong>
          <span className="muted small">
            {lastCheck
              ? `Dernier : ${lastLevel ?? "?"} · ${frDate(lastCheck.started_at)}${checkDue ? " · c'est le moment d'en refaire un" : ""}`
              : "10 minutes pour mesurer ton niveau et fixer tes priorités"}
          </span>
        </span>
        <span className="muted">›</span>
      </Link>

      <h3>Les leçons</h3>
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
