import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { db, type WordRow } from "@/lib/db";
import { MASTERED_STAGE } from "@/lib/learning";
import { Say } from "../feedback/[id]/client";

export const dynamic = "force-dynamic";

export default async function Mots() {
  await requireAuth();
  const words = db().prepare("SELECT * FROM words ORDER BY due_at ASC").all() as WordRow[];
  const now = new Date().toISOString();
  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">{words.length} mots</span>
      </header>
      <h1>Mes mots</h1>
      {!words.length && <p className="muted">Tes mots apparaîtront ici après ta première séance.</p>}
      <ul className="words card">
        {words.map((w) => (
          <li key={w.word}>
            <Say text={`${w.word}. ${w.example}`} />
            <div className="grow">
              <strong>{w.word}</strong> <span className="muted">— {w.translation}</span>
              {w.example && <div className="example">{w.example}</div>}
            </div>
            <span className="meter" title={`niveau ${w.stage}/${MASTERED_STAGE}`}>
              {"●".repeat(w.stage)}{"○".repeat(Math.max(0, MASTERED_STAGE - w.stage))}
              {w.due_at <= now && w.stage < MASTERED_STAGE && <em> à revoir</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
