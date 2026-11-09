import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getCache, todayKey } from "@/lib/cache";
import type { Podcast } from "@/lib/generate";
import GenerateButton from "../GenerateButton";
import TabBar from "../TabBar";
import Player from "./Player";

export const dynamic = "force-dynamic";

export default async function PodcastPage() {
  await requireAuth();
  const podcast = getCache<Podcast>(`podcast:${todayKey()}`);
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/lecons" className="link">‹ Leçons</Link>
        <span className="muted small">{todayKey()}</span>
      </header>
      <div>
        <h1>📻 Le podcast de Carla</h1>
        <p className="muted">2 minutes d'écoute par jour avec tes mots, puis 3 questions. Parfait pour le trajet.</p>
      </div>
      {podcast ? (
        <Player podcast={podcast} />
      ) : (
        <GenerateButton url="/api/generate/podcast" label="Préparer l'épisode du jour" busyLabel="Carla écrit l'épisode…" />
      )}
      <TabBar active="lecons" />
    </div>
  );
}
