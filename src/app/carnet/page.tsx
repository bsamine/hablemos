import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { frDate } from "@/lib/format";
import { listVoiceNotes } from "@/lib/voice";
import TabBar from "../TabBar";
import VoiceRecorder from "../VoiceRecorder";
import VoiceResult from "../VoiceResult";

export const dynamic = "force-dynamic";

export default async function Carnet() {
  await requireAuth();
  const notes = listVoiceNotes("missing", 20).filter((n) => n.status === "done");
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/vie-reelle" className="link">‹ Vie réelle</Link>
      </header>
      <div>
        <h1>📓 Les mots qui m'ont manqué</h1>
        <p className="muted">
          Après une vraie conversation, dis en 30 secondes ce que tu voulais dire sans y arriver, en français ou en espagnol.
          Carla te donne la bonne phrase et la fait revenir dans tes révisions.
        </p>
      </div>
      <VoiceRecorder kind="missing" label="Dire ce qui m'a manqué" maxSeconds={60} hint="Ex. : « Je voulais dire que j'avais déjà géré les stocks… »" />
      {notes.length > 0 && <h3>Mon carnet</h3>}
      {notes.map((n) => (
        <section key={n.id} className="stack">
          <p className="muted small">{frDate(n.created_at)}</p>
          <VoiceResult kind="missing" result={JSON.parse(n.result!)} />
        </section>
      ))}
      <TabBar active="vie-reelle" />
    </div>
  );
}
