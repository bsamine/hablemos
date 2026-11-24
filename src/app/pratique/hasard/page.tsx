import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { asLength, LENGTH_MINUTES } from "@/lib/modes";
import { getProfile } from "@/lib/profile";
import { getSituation, pickSituation, situationsFor } from "@/lib/situations";
import Conversation from "../../Conversation";
import LengthPicker from "../../LengthPicker";
import TabBar from "../../TabBar";

export const dynamic = "force-dynamic";

/** "Conversation au hasard": an everyday situation, drawn at random or chosen from the list. */
export default async function Hasard({ searchParams }: { searchParams: Promise<{ theme?: string; duree?: string }> }) {
  await requireAuth();
  const q = await searchParams;
  const length = asLength(q.duree);
  const level = getProfile().level;
  const recent = (
    db()
      .prepare("SELECT scenario_id FROM sessions WHERE mode = 'random' AND transcript IS NOT NULL ORDER BY id DESC LIMIT 6")
      .all() as { scenario_id: string }[]
  ).map((r) => r.scenario_id);
  const sit = getSituation(q.theme) ?? pickSituation(level, recent);
  const all = situationsFor(level);
  const duree = length === "long" ? "longue" : "rapide";

  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="chip">Niveau {level}</span>
      </header>
      <div>
        <p className="eyebrow">Conversation au hasard</p>
        <h1>
          <span aria-hidden>{sit.emoji}</span> {sit.title}
        </h1>
        <p className="muted">
          {sit.titleFr} · {sit.kind === "role-play" ? "jeu de rôle" : "discussion de la vie"}
        </p>
      </div>
      <div className="row">
        <Link className="secondary pill" href={`/pratique/hasard?duree=${duree}`}>🎲 Autre thème</Link>
      </div>
      <LengthPicker base={`/pratique/hasard?theme=${sit.id}`} value={length} />
      <Conversation
        key={`${sit.id}-${length}`}
        preview={{
          title: sit.title,
          taskGoal:
            sit.kind === "role-play"
              ? `${sit.titleFr} : Carla joue le rôle de ${sit.persona}. Elle te donne d'abord les mots utiles, puis à toi de te débrouiller en espagnol !`
              : `${sit.titleFr} : une vraie discussion avec Carla, comme entre amies. Elle te donne d'abord quelques mots utiles.`,
          words: [],
          minutes: LENGTH_MINUTES[length],
        }}
        start={{ mode: "random", situationId: sit.id, length }}
      />
      <details className="card">
        <summary>Choisir un thème</summary>
        <div className="chips">
          {all.map((s) => (
            <Link key={s.id} href={`/pratique/hasard?theme=${s.id}&duree=${duree}`} className={`chip-link ${s.id === sit.id ? "on" : ""}`}>
              {s.emoji} {s.titleFr}
            </Link>
          ))}
        </div>
      </details>
      <TabBar active="hasard" />
    </div>
  );
}
