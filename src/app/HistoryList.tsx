import Link from "next/link";
import { frDate, minutes } from "@/lib/format";
import type { HistoryItem } from "@/lib/history";
import { getScenario } from "@/lib/scenarios";

const BADGE = { done: "Bilan prêt", pending: "Bilan en cours…", error: "Bilan à relancer" } as const;

export default function HistoryList({ items, showTitle = true }: { items: HistoryItem[]; showTitle?: boolean }) {
  if (!items.length) return <p className="muted small">Aucune séance pour l'instant.</p>;
  return (
    <ul className="list">
      {items.map((h) => (
        <li key={h.id}>
          <Link href={`/feedback/${h.id}`}>
            <span className={`badge ${h.status}`}>{h.status === "done" ? "✓" : h.status === "pending" ? "…" : "!"}</span>
            <span className="grow">
              <strong>{showTitle ? (getScenario(h.scenarioId)?.title ?? h.scenarioId) : frDate(h.startedAt)}</strong>
              <span className="muted small">
                {showTitle && `${frDate(h.startedAt)} · `}
                {minutes(h.durationS)} · {h.status === "done" ? `${h.wordsUsed} mots utilisés seule · ${h.errors} corrections` : BADGE[h.status]}
              </span>
            </span>
            <span className="muted">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
