import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { practiceSentences } from "@/lib/modes";
import { Say } from "../feedback/[id]/client";
import TabBar from "../TabBar";
import VoiceRecorder from "../VoiceRecorder";

export const dynamic = "force-dynamic";

export default async function Prononciation() {
  await requireAuth();
  const sentences = practiceSentences(6);
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/lecons" className="link">‹ Leçons</Link>
      </header>
      <div>
        <h1>🎯 Ma prononciation</h1>
        <p className="muted">
          Écoute la phrase, lis-la à voix haute, et Carla te dit quels mots sonnent bien et lesquels travailler. Les mots en rouge
          ont un conseil.
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
