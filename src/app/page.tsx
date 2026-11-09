import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCache, weekKey } from "@/lib/cache";
import { daysUntil, listEvents } from "@/lib/events";
import { planHref, type WeekPlan } from "@/lib/generate";
import { history } from "@/lib/history";
import { listJobAds } from "@/lib/jobs";
import { doneScenarioIds, stats } from "@/lib/learning";
import { currentMission, missionStats } from "@/lib/missions";
import { getProfile, LEVELS, levelSuggestion } from "@/lib/profile";
import { LESSONS } from "@/lib/scenarios";
import GenerateButton from "./GenerateButton";
import HistoryList from "./HistoryList";
import MissionCard from "./MissionCard";
import TabBar from "./TabBar";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAuth();
  const profile = getProfile();
  const s = stats();
  const done = doneScenarioIds();
  const levelIdx = LEVELS.indexOf(profile.level);
  const fits = LESSONS.filter((x) => LEVELS.indexOf(x.level) <= levelIdx + 1);
  const next = fits.find((x) => !done.has(x.id)) ?? fits[0] ?? LESSONS[0];
  const recent = history({ limit: 3 });
  const suggestion = levelSuggestion();
  const mission = currentMission();
  const jobs = listJobAds().length;
  const missionsDone = missionStats().done;
  const lessonsDone = LESSONS.filter((x) => done.has(x.id)).length;
  const plan = getCache<WeekPlan>(`plan:${weekKey()}`);
  const soon = listEvents().upcoming.filter((e) => daysUntil(e.date) <= 3);

  return (
    <div className="stack with-tabbar">
      <header className="top">
        <div className="hello">
          <img src="/carla.svg" alt="" className="avatar small-avatar" />
          <div>
            <h1 className="logo">¡Hola{profile.name ? `, ${profile.name}` : ""}!</h1>
            <span className="muted small">Niveau {profile.level} · avec Carla</span>
          </div>
        </div>
        <Link href="/profil" className="link small">Profil</Link>
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
        <Link href="/progres"><strong>{s.mastered}/{s.words}</strong><span>mots maîtrisés ›</span></Link>
      </section>

      {soon.map((ev) => (
        <Link key={ev.id} href={`/moment/${ev.id}`} className="card mission">
          <p className="eyebrow">📅 {daysUntil(ev.date) === 0 ? "Aujourd'hui" : daysUntil(ev.date) === 1 ? "Demain" : `Dans ${daysUntil(ev.date)} jours`}</p>
          <p className="mission-text">{ev.title}</p>
          <span className="muted small">{ev.pocket ? "Ta carte de poche est prête · répète avec Carla" : "Répète avec Carla et prépare ta carte de poche"} ›</span>
        </Link>
      ))}

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

      <Link href={`/session/${next.id}`} className="card hero">
        <p className="eyebrow">Aujourd'hui · {next.theme} · {next.level}</p>
        <h2>{next.title}</h2>
        <p className="muted">{next.titleFr}</p>
        <span className="primary pill">Parler avec Carla →</span>
      </Link>

      {mission && <MissionCard mission={mission} next="/" />}

      <section className="areas">
        <Link href="/lecons" className="card area">
          <span className="area-icon">📚</span>
          <span className="grow">
            <strong>Leçons</strong>
            <span className="muted small">Apprendre pas à pas · {lessonsDone}/{LESSONS.length} faites{s.due ? ` · ${s.due} mots à revoir` : ""}</span>
          </span>
          <span className="muted">›</span>
        </Link>
        <Link href="/entretiens" className="card area">
          <span className="area-icon">💼</span>
          <span className="grow">
            <strong>Entretiens</strong>
            <span className="muted small">S'entraîner sur de vraies offres · {jobs} offre{jobs > 1 ? "s" : ""}</span>
          </span>
          <span className="muted">›</span>
        </Link>
        <Link href="/vie-reelle" className="card area">
          <span className="area-icon">🌍</span>
          <span className="grow">
            <strong>Vie réelle</strong>
            <span className="muted small">Missions, duo, situations à toi · {missionsDone} mission{missionsDone > 1 ? "s" : ""} réussie{missionsDone > 1 ? "s" : ""}</span>
          </span>
          <span className="muted">›</span>
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

      <form action="/api/logout" method="post" className="center-small">
        <button className="link small" type="submit">Se déconnecter</button>
      </form>
      <TabBar active="accueil" />
    </div>
  );
}
