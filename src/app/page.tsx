import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCache, weekKey } from "@/lib/cache";
import { daysUntil, listEvents } from "@/lib/events";
import { labEnabled } from "@/lib/features";
import { planHref, type WeekPlan } from "@/lib/generate";
import { history } from "@/lib/history";
import { listJobAds } from "@/lib/jobs";
import { doneScenarioIds, stats } from "@/lib/learning";
import { currentMission, missionStats } from "@/lib/missions";
import { getProfile, LEVELS, levelSuggestion } from "@/lib/profile";
import { LESSONS } from "@/lib/scenarios";
import { pickSituation, situationsFor } from "@/lib/situations";
import GenerateButton from "./GenerateButton";
import HistoryList from "./HistoryList";
import MissionCard from "./MissionCard";
import TabBar from "./TabBar";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }));
  return h < 6 || h >= 20 ? "¡Buenas noches" : h < 13 ? "¡Buenos días" : "¡Buenas tardes";
}

export default async function Home() {
  await requireAuth();
  const lab = labEnabled();
  const profile = getProfile();
  const s = stats();
  const done = doneScenarioIds();
  const levelIdx = LEVELS.indexOf(profile.level);
  const fits = LESSONS.filter((x) => LEVELS.indexOf(x.level) <= levelIdx + 1);
  const next = fits.find((x) => !done.has(x.id)) ?? fits[0] ?? LESSONS[0];
  const recent = history({ limit: 3 });
  const suggestion = levelSuggestion();
  const lessonsDone = LESSONS.filter((x) => done.has(x.id)).length;
  const sit = pickSituation(profile.level);
  const themes = situationsFor(profile.level).filter((x) => x.id !== sit.id).slice(0, 5);

  // Labo only
  const mission = lab ? currentMission() : undefined;
  const jobs = lab ? listJobAds().length : 0;
  const missionsDone = lab ? missionStats().done : 0;
  const plan = lab ? getCache<WeekPlan>(`plan:${weekKey()}`) : undefined;
  const soon = lab ? listEvents().upcoming.filter((e) => daysUntil(e.date) <= 3) : [];

  return (
    <div className="stack with-tabbar home">
      <header className="top">
        <div className="hello">
          <img src="/carla.svg" alt="" className="avatar small-avatar" />
          <div>
            <h1 className="logo">{greeting()}{profile.name ? `, ${profile.name}` : ""}!</h1>
            <span className="muted small">Niveau {profile.level} · avec Carla</span>
          </div>
        </div>
      </header>

      {!profile.name && (
        <Link href="/profil" className="card notice-card">
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

      <section className="today">
        <p className="eyebrow light">Aujourd'hui · {next.theme} · {next.level}</p>
        <h2>{next.title}</h2>
        <p className="today-fr">{next.titleFr}</p>
        <div className="today-actions">
          <Link href={`/session/${next.id}?duree=rapide`} className="choice">
            <strong>⚡ Rapide</strong>
            <span>10 min · l'essentiel</span>
          </Link>
          <Link href={`/session/${next.id}?duree=longue`} className="choice">
            <strong>🎯 Longue</strong>
            <span>30 min · en profondeur</span>
          </Link>
        </div>
      </section>

      <section className="card random-card">
        <div className="top">
          <p className="eyebrow">Conversation au hasard</p>
          <Link href="/pratique/hasard" className="link small">🎲 Tirer au sort</Link>
        </div>
        <Link href={`/pratique/hasard?theme=${sit.id}`} className="random-main">
          <span className="random-emoji" aria-hidden>{sit.emoji}</span>
          <span className="grow">
            <strong>{sit.titleFr}</strong>
            <span className="muted small">{sit.title} · {sit.kind === "role-play" ? "jeu de rôle" : "discussion"}</span>
          </span>
          <span className="go">›</span>
        </Link>
        <div className="chips scroll">
          {themes.map((t) => (
            <Link key={t.id} href={`/pratique/hasard?theme=${t.id}`} className="chip-link">
              {t.emoji} {t.titleFr}
            </Link>
          ))}
        </div>
      </section>

      {s.due > 0 && (
        <Link href="/pratique/revision" className="card area">
          <span className="area-icon">⚡</span>
          <span className="grow">
            <strong>Révision express</strong>
            <span className="muted small">{Math.min(s.due, 8)} mots à revoir · 4 min</span>
          </span>
          <span className="go">›</span>
        </Link>
      )}

      <section className="stats">
        <div><strong>🔥 {s.streak}</strong><span>jour{s.streak > 1 ? "s" : ""} d'affilée</span></div>
        <div><strong>{s.minutes}</strong><span>minutes parlées</span></div>
        <Link href="/mots"><strong>{s.mastered}/{s.words}</strong><span>mots maîtrisés ›</span></Link>
      </section>

      {soon.map((ev) => (
        <Link key={ev.id} href={`/moment/${ev.id}`} className="card mission">
          <p className="eyebrow">📅 {daysUntil(ev.date) === 0 ? "Aujourd'hui" : daysUntil(ev.date) === 1 ? "Demain" : `Dans ${daysUntil(ev.date)} jours`}</p>
          <p className="mission-text">{ev.title}</p>
          <span className="muted small">{ev.pocket ? "Ta carte de poche est prête · répète avec Carla" : "Répète avec Carla et prépare ta carte de poche"} ›</span>
        </Link>
      ))}

      {lab && (
        <section className="card stack">
          <div className="top">
            <p className="eyebrow">Ta semaine avec Carla</p>
            {plan && <span className="muted small">{plan.focus_fr}</span>}
          </div>
          {plan ? (
            <>
              <p className="small">{plan.intro_fr}</p>
              <ul className="list plan">
                {plan.items.map((it, i) => (
                  <li key={i}>
                    <Link href={planHref(it)}>
                      <span className="day small">{it.day.slice(0, 3)}</span>
                      <span className="grow">
                        <strong>{it.title_fr}</strong>
                        <span className="muted small">{it.why_fr}</span>
                      </span>
                      <span className="muted">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="small muted">Carla construit ton programme à partir de tes moments à venir, de tes erreurs et de ce qui t'a manqué.</p>
              <GenerateButton url="/api/generate/plan" label="Préparer ma semaine" busyLabel="Carla prépare ta semaine…" />
            </>
          )}
        </section>
      )}

      {mission && <MissionCard mission={mission} next="/" />}

      <section className="areas">
        <Link href="/lecons" className="card area">
          <span className="area-icon">📚</span>
          <span className="grow">
            <strong>Toutes les leçons</strong>
            <span className="muted small">Apprendre pas à pas · {lessonsDone}/{LESSONS.length} faites</span>
          </span>
          <span className="go">›</span>
        </Link>
        {lab && (
          <>
            <Link href="/entretiens" className="card area">
              <span className="area-icon">💼</span>
              <span className="grow">
                <strong>Entretiens</strong>
                <span className="muted small">S'entraîner sur de vraies offres · {jobs} offre{jobs > 1 ? "s" : ""}</span>
              </span>
              <span className="go">›</span>
            </Link>
            <Link href="/vie-reelle" className="card area">
              <span className="area-icon">🌍</span>
              <span className="grow">
                <strong>Vie réelle</strong>
                <span className="muted small">Missions, duo, situations à toi · {missionsDone} mission{missionsDone > 1 ? "s" : ""} réussie{missionsDone > 1 ? "s" : ""}</span>
              </span>
              <span className="go">›</span>
            </Link>
          </>
        )}
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

      <form action="/api/logout" method="post" className="center-small">
        <button className="link small muted" type="submit">Se déconnecter</button>
      </form>
      <TabBar active="accueil" />
    </div>
  );
}
