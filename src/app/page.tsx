import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { history } from "@/lib/history";
import { listJobAds } from "@/lib/jobs";
import { doneScenarioIds, stats } from "@/lib/learning";
import { currentMission, missionStats } from "@/lib/missions";
import { getProfile, LEVELS, levelSuggestion } from "@/lib/profile";
import { LESSONS } from "@/lib/scenarios";
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
