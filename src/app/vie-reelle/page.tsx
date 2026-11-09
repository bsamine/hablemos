import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { daysUntil, EVENT_KINDS, listEvents } from "@/lib/events";
import { frDate } from "@/lib/format";
import { listJobAds } from "@/lib/jobs";
import { history } from "@/lib/history";
import { currentMission, listMissions } from "@/lib/missions";
import { DUO_GAMES } from "@/lib/modes";
import { getProfile } from "@/lib/profile";
import HistoryList from "../HistoryList";
import MissionCard from "../MissionCard";
import TabBar from "../TabBar";

export const dynamic = "force-dynamic";

export default async function VieReelle({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requireAuth();
  const { e } = await searchParams;
  const events = listEvents();
  const ads = listJobAds();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const p = getProfile();
  const mission = currentMission();
  const doneMissions = listMissions().filter((m) => m.status === "done");
  const past = history({ modes: ["custom", "duo", "prep"], limit: 8 });

  return (
    <div className="stack with-tabbar">
      <header className="area-header">
        <span className="area-icon">🌍</span>
        <div>
          <h1>Vie réelle</h1>
          <p className="muted small">Sortir l'espagnol de l'appli</p>
        </div>
      </header>

      <section className="stack" id="moments">
        <h3>📅 Mes prochains moments en espagnol</h3>
        <p className="muted small">
          Un entretien, un rendez-vous, un dîner avec des amis… Ajoute-le : Carla te fait répéter avant, te donne une carte de
          poche pour le jour J, et t'aide à débriefer après.
        </p>
        {events.upcoming.length > 0 && (
          <ul className="list">
            {events.upcoming.map((ev) => {
              const d = daysUntil(ev.date);
              return (
                <li key={ev.id}>
                  <Link href={`/moment/${ev.id}`}>
                    <span className="area-icon">{EVENT_KINDS.find((k) => k.id === ev.kind)?.icon}</span>
                    <span className="grow">
                      <strong>{ev.title}</strong>
                      <span className="muted small">
                        {d === 0 ? "Aujourd'hui" : d === 1 ? "Demain" : `Dans ${d} jours`} · {ev.pocket ? "carte prête" : "carte à préparer"}
                      </span>
                    </span>
                    <span className="muted">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <details className="card">
          <summary>+ Ajouter un moment</summary>
          <form action="/api/events" method="post" className="stack add-moment">
            <input name="title" required maxLength={120} placeholder="Ex. : dîner chez Lucas et Marta" />
            <div className="row">
              <input name="date" type="date" required min={today} defaultValue={today} />
              <select name="kind" defaultValue="social">
                {EVENT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>{k.icon} {k.label}</option>
                ))}
              </select>
            </div>
            <textarea name="details" rows={2} maxLength={1000} placeholder="Contexte : qui, où, ce qui t'inquiète…" />
            {ads.length > 0 && (
              <select name="job_ad_id" defaultValue="">
                <option value="">Pas lié à une offre d'emploi</option>
                {ads.map((a) => (
                  <option key={a.id} value={a.id}>Entretien : {a.title}{a.company ? ` (${a.company})` : ""}</option>
                ))}
              </select>
            )}
            {e === "moment" && <p className="error small">Il faut un titre et une date.</p>}
            <button className="primary" type="submit">Ajouter</button>
          </form>
        </details>
      </section>

      <Link href="/carnet" className="card area">
        <span className="area-icon">📓</span>
        <span className="grow">
          <strong>Les mots qui m'ont manqué</strong>
          <span className="muted small">Après une vraie conversation : 30 s pour dire ce que tu n'as pas su dire</span>
        </span>
        <span className="muted">›</span>
      </Link>

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

      <Link href="/coach" className="card area">
        <span className="area-icon">🤝</span>
        <span className="grow">
          <strong>Le coin du coach</strong>
          <span className="muted small">Pour {p.partner || "ton partenaire"} : comment t'aider à pratiquer cette semaine</span>
        </span>
        <span className="muted">›</span>
      </Link>

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

      {events.past.length > 0 && (
        <section className="stack">
          <h3>Moments passés</h3>
          <ul className="list">
            {events.past.slice(0, 6).map((ev) => (
              <li key={ev.id}>
                <Link href={`/moment/${ev.id}`}>
                  <span className={`badge ${ev.status === "done" ? "done" : ""}`}>{ev.status === "done" ? "✓" : "…"}</span>
                  <span className="grow">
                    <strong>{ev.title}</strong>
                    <span className="muted small">{frDate(ev.date + "T12:00:00Z")} · {ev.status === "done" ? "débriefé" : "à raconter à Carla"}</span>
                  </span>
                  <span className="muted">›</span>
                </Link>
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
