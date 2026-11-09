import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { history } from "@/lib/history";
import { doneScenarioIds, stats } from "@/lib/learning";
import { getProfile, LEVELS, levelSuggestion } from "@/lib/profile";
import { SCENARIOS } from "@/lib/scenarios";
import HistoryList from "./HistoryList";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAuth();
  const profile = getProfile();
  const s = stats();
  const done = doneScenarioIds();
  const levelIdx = LEVELS.indexOf(profile.level);
  const fits = SCENARIOS.filter((x) => LEVELS.indexOf(x.level) <= levelIdx + 1);
  const next = fits.find((x) => !done.has(x.id)) ?? fits[0] ?? SCENARIOS[0];
  const recent = history({ limit: 3 });
  const suggestion = levelSuggestion();
  const themes = [...new Set(SCENARIOS.map((x) => x.theme))];

  return (
    <div className="stack">
      <header className="top">
        <div className="hello">
          <img src="/carla.svg" alt="" className="avatar small-avatar" />
          <div>
            <h1 className="logo">¡Hola{profile.name ? `, ${profile.name}` : ""}!</h1>
            <span className="muted small">Niveau {profile.level} · avec Carla</span>
          </div>
        </div>
        <form action="/api/logout" method="post">
          <button className="link small" type="submit">Sortir</button>
        </form>
      </header>

      {!profile.name && (
        <Link href="/profil" className="card hero">
          <p className="eyebrow">Première étape</p>
          <h2>Présente-toi à Carla</h2>
          <p className="muted">Ton prénom et quelques mots sur toi : elle s'en servira dans chaque conversation.</p>
          <span className="primary pill">Faire connaissance →</span>
        </Link>
      )}

      {suggestion && (
        <section className="card good">
          <p className="eyebrow">Bravo !</p>
          <p>Tes dernières séances montrent un niveau {suggestion}. Carla peut parler un peu plus vite et t'emmener plus loin.</p>
          <div className="row">
            <form action="/api/level" method="post">
              <input type="hidden" name="level" value={suggestion} />
              <button className="primary" type="submit">Passer en {suggestion}</button>
            </form>
            <form action="/api/level" method="post">
              <button className="secondary" type="submit">Plus tard</button>
            </form>
          </div>
        </section>
      )}

      <section className="stats">
        <div><strong>{s.streak}</strong><span>jours d'affilée</span></div>
        <div><strong>{s.minutes}</strong><span>minutes parlées</span></div>
        <Link href="/mots"><strong>{s.mastered}/{s.words}</strong><span>mots maîtrisés</span></Link>
      </section>

      <Link href={`/session/${next.id}`} className="card hero">
        <p className="eyebrow">Séance du jour · {next.theme} · {next.level}</p>
        <h2>{next.title}</h2>
        <p className="muted">{next.titleFr}</p>
        <span className="primary pill">Parler avec Carla →</span>
      </Link>

      <section className="quick">
        <Link href="/pratique/revision" className={`card ${s.due ? "" : "dim"}`}>
          <strong>⚡ Révision express</strong>
          <span className="muted small">{s.due ? `${Math.min(s.due, 8)} mots · 4 min` : "Rien à revoir aujourd'hui"}</span>
        </Link>
        <Link href="/pratique/theme" className="card">
          <strong>✍️ Mon thème</strong>
          <span className="muted small">Une situation à toi</span>
        </Link>
        <Link href="/progres" className="card">
          <strong>📈 Mes progrès</strong>
          <span className="muted small">Minutes, mots, erreurs</span>
        </Link>
        <Link href="/profil" className="card">
          <strong>💬 Ce que Carla sait</strong>
          <span className="muted small">Profil et mémoire</span>
        </Link>
      </section>

      {recent.length > 0 && (
        <>
          <div className="top">
            <h3>Mes derniers bilans</h3>
            <Link href="/historique" className="link small">Tout voir ›</Link>
          </div>
          <HistoryList items={recent} />
        </>
      )}

      <h3>Toutes les séances</h3>
      {themes.map((theme) => (
        <details key={theme} className="theme-group" open={theme === next.theme}>
          <summary>
            {theme}{" "}
            <span className="muted small">
              {SCENARIOS.filter((x) => x.theme === theme && done.has(x.id)).length}/
              {SCENARIOS.filter((x) => x.theme === theme).length}
            </span>
          </summary>
          <ul className="list">
            {SCENARIOS.filter((x) => x.theme === theme).map((x) => (
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
    </div>
  );
}
