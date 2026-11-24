import { requireLab } from "@/lib/features";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { practiceSentences } from "@/lib/modes";
import { Say } from "../feedback/[id]/client";
import TabBar from "../TabBar";
import VoiceRecorder from "../VoiceRecorder";

export const dynamic = "force-dynamic";

export default async function Prononciation() {
  await requireAuth();
  requireLab();
  const sentences = practiceSentences(6);
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/lecons" className="link">‹ Leçons</Link>
      </header>
      <div>
        <h1>🎯 Ma prononciation</h1>
        <p className="muted">
          Écoute Carla, puis lis la phrase à voix haute. Carla te dit ce qu'elle a vraiment entendu, mot par mot, puis te redit
          la phrase correctement, avec un guide de prononciation.
        </p>
      </div>
      {sentences.map((t) => (
        <section key={t} className="card stack">
          <p className="better"><Say text={t} /> {t}</p>
          <VoiceRecorder kind="pronunciation" refId={t} label="Lire la phrase" maxSeconds={15} compact />
        </section>
      ))}
      {!sentences.length && <p className="card">Fais d'abord une leçon : cet exercice utilise tes phrases.</p>}
      <TabBar active="lecons" />
    </div>
  );
}
