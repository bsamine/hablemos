import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { frDate } from "@/lib/format";
import { history } from "@/lib/history";
import { currentMission, listMissions } from "@/lib/missions";
import { DUO_GAMES } from "@/lib/modes";
import { getProfile } from "@/lib/profile";
import HistoryList from "../HistoryList";
import MissionCard from "../MissionCard";
import TabBar from "../TabBar";

export const dynamic = "force-dynamic";

export default async function VieReelle() {
  await requireAuth();
  const p = getProfile();
  const mission = currentMission();
  const doneMissions = listMissions().filter((m) => m.status === "done");
  const past = history({ modes: ["custom", "duo"], limit: 8 });

  return (
    <div className="stack with-tabbar">
      <header className="area-header">
        <span className="area-icon">🌍</span>
        <div>
          <h1>Vie réelle</h1>
          <p className="muted small">Sortir l'espagnol de l'appli</p>
        </div>
      </header>

      {mission ? (
        <MissionCard mission={mission} next="/vie-reelle" />
      ) : (
        <section className="card">
          <p className="eyebrow">🎯 Missions</p>
          <p>Après chaque leçon, Carla te donne une petite mission à faire dans la vraie vie (commander un café, envoyer un vocal…). Fais une leçon pour recevoir la prochaine.</p>
        </section>
      )}

      <section className="stack">
        <h3>👫 Mode duo</h3>
        <p className="muted small">
          Parlez espagnol à deux{p.partner ? ` avec ${p.partner}` : ""}, dans le même micro : Carla anime le jeu et corrige
          {p.name ? ` ${p.name}` : " l'élève"} en douceur.
          {p.partner && (
            <>
              {" "}
              <Link href="/pratique/duo" className="link">Changer de partenaire</Link>
            </>
          )}
        </p>
        <div className="quick">
          {DUO_GAMES.map((g) => (
            <Link key={g.id} href={`/pratique/duo?jeu=${g.id}`} className="card">
              <strong>{g.title}</strong>
              <span className="muted small">{g.titleFr}</span>
            </Link>
          ))}
        </div>
      </section>

      <Link href="/pratique/theme" className="card area">
        <span className="area-icon">✍️</span>
        <span className="grow">
          <strong>Mon thème</strong>
          <span className="muted small">Une situation réelle à préparer : Carla joue le rôle</span>
        </span>
        <span className="muted">›</span>
      </Link>

      {doneMissions.length > 0 && (
        <section className="stack">
          <h3>Missions réussies ({doneMissions.length})</h3>
          <ul className="list">
            {doneMissions.map((m) => (
              <li key={m.id} className="card fact">
                <span className="badge done">✓</span>
                <span className="grow">
                  {m.text}
                  {m.note && <span className="muted small">« {m.note} »</span>}
                  <span className="muted small">{m.done_at ? frDate(m.done_at) : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <>
          <h3>Bilans duo et thèmes</h3>
          <HistoryList items={past} />
        </>
      )}
      <TabBar active="vie-reelle" />
    </div>
  );
}
