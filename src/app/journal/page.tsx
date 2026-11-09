import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { frDate } from "@/lib/format";
import { listVoiceNotes } from "@/lib/voice";
import type { DiaryResult } from "@/lib/voice-handlers";
import TabBar from "../TabBar";
import VoiceRecorder from "../VoiceRecorder";
import VoiceResult from "../VoiceResult";

export const dynamic = "force-dynamic";

export default async function Journal() {
  await requireAuth();
  const notes = listVoiceNotes("diary", 14).filter((n) => n.status === "done");
  const lastQuestion = notes[0] ? (JSON.parse(notes[0].result!) as DiaryResult).question_es : "";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const doneToday = notes.some(
    (n) => new Date(n.created_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }) === today,
  );
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/lecons" className="link">‹ Leçons</Link>
        <span className="muted small">{notes.length} jour{notes.length > 1 ? "s" : ""}</span>
      </header>
      <div>
        <h1>🎧 Mon journal vocal</h1>
        <p className="muted">Une minute par jour, en espagnol. Carla te répond par écrit avec 2 corrections et une question pour demain.</p>
      </div>
      <section className="card hero">
        <p className="eyebrow">{doneToday ? "C'est fait pour aujourd'hui ✓" : "Aujourd'hui"}</p>
        <p className="mission-text">{lastQuestion || "¿Qué tal tu día? ¿Qué has hecho hoy?"}</p>
        <VoiceRecorder kind="diary" label="Raconter ma journée (1 min)" maxSeconds={75} />
      </section>
      {notes.map((n) => (
        <section key={n.id} className="stack">
          <p className="muted small">{frDate(n.created_at)} · « {(JSON.parse(n.result!) as DiaryResult).transcript.slice(0, 120)}… »</p>
          <VoiceResult kind="diary" result={JSON.parse(n.result!)} />
        </section>
      ))}
      <TabBar active="lecons" />
    </div>
  );
}
