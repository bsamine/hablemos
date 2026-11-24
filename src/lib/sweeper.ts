import { db, type SessionRow } from "./db";
import { isStale, startDebrief, type Turn } from "./debrief";
import { logError } from "./errors";

/** A live session with no news from the browser for this long is considered abandoned. */
export const ABANDON_AFTER_MS = 30 * 60_000;
/** A "pending" debrief with no job behind it for this long was lost (redeploy, crash). */
export const LOST_DEBRIEF_AFTER_MS = 5 * 60_000;

/**
 * Close sessions the browser never ended (phone locked, tab killed, network gone) and
 * debrief whatever was said; restart debriefs lost in a redeploy.
 * Returns the ids it acted on, for logs and tests.
 */
export function sweep(now = Date.now()): { closed: number[]; restarted: number[] } {
  const closed: number[] = [];
  const restarted: number[] = [];
  const cutoff = new Date(now - ABANDON_AFTER_MS).toISOString();

  const open = db()
    .prepare(
      `SELECT * FROM sessions WHERE ended_at IS NULL AND feedback IS NULL
         AND COALESCE(last_seen_at, started_at) < ?`,
    )
    .all(cutoff) as SessionRow[];
  for (const row of open) {
    const turns: Turn[] = row.transcript ? JSON.parse(row.transcript) : [];
    const end = row.last_seen_at ?? row.started_at;
    db().prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(end, row.id);
    if (turns.some((t) => t.role === "learner")) {
      startDebrief(row.id);
      closed.push(row.id);
    }
  }

  const lostCutoff = new Date(now - LOST_DEBRIEF_AFTER_MS).toISOString();
  const pending = db()
    .prepare("SELECT * FROM sessions WHERE debrief_status = 'pending' AND feedback IS NULL AND debrief_started_at < ?")
    .all(lostCutoff) as SessionRow[];
  for (const row of pending) {
    if (isStale(row)) {
      startDebrief(row.id);
      restarted.push(row.id);
    }
  }

  if (closed.length || restarted.length)
    console.log(`sweep: closed ${closed.join(",") || "-"}; restarted ${restarted.join(",") || "-"}`);
  return { closed, restarted };
}

export function safeSweep() {
  try {
    sweep();
  } catch (e) {
    logError("sweep", e);
  }
}
