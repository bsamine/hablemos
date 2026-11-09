import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCache, weekKey } from "@/lib/cache";
import type { CoachNote } from "@/lib/generate";
import { getProfile } from "@/lib/profile";
import { Say } from "../feedback/[id]/client";
import GenerateButton from "../GenerateButton";
import TabBar from "../TabBar";

export const dynamic = "force-dynamic";

export default async function Coach() {
  await requireAuth();
  const p = getProfile();
  const note = getCache<CoachNote>(`coach:${weekKey()}`);
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/vie-reelle" className="link">‹ Vie réelle</Link>
        <span className="muted small">Semaine du {weekKey()}</span>
      </header>
      <div>
        <h1>🤝 Le coin du coach</h1>
        <p className="muted">
          Pour {p.partner || "son partenaire"} : ce qu'elle a travaillé cette semaine et comment l'aider à pratiquer à la maison,
          sans jouer au professeur.
        </p>
      </div>
      {!note ? (
        <GenerateButton url="/api/generate/coach" label="Préparer la note de la semaine" busyLabel="Carla relit la semaine…" />
      ) : (
        <>
          <section className="card">
            <p>{note.summary_fr}</p>
          </section>
          <section className="card good">
            <p className="eyebrow">À féliciter</p>
            <ul>{note.wins_fr.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </section>
          <h3>3 idées pour pratiquer ensemble</h3>
          {note.ideas.map((idea, i) => (
            <section key={i} className="card stack">
              <strong>{idea.title_fr}</strong>
              <p className="small">{idea.how_fr}</p>
              <ul className="words">
                {idea.phrases_es.map((ph, j) => (
                  <li key={j}><Say text={ph} /> <span>{ph}</span></li>
                ))}
              </ul>
            </section>
          ))}
          <section className="card hero">
            <p className="eyebrow">L'heure en espagnol</p>
            <p>{note.spanish_hour_fr}</p>
          </section>
          <p className="muted small">À éviter : {note.avoid_fr}</p>
          <GenerateButton url="/api/generate/coach" label="Refaire la note" variant="secondary" />
        </>
      )}
      <TabBar active="vie-reelle" />
    </div>
  );
}
