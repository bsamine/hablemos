import { db, type SessionRow } from "./db";
import type { Feedback } from "./prompts";

export type HistoryItem = {
  id: number;
  scenarioId: string;
  startedAt: string;
  durationS: number | null;
  status: "done" | "pending" | "error";
  errors: number;
  wordsUsed: number;
};

/** Sessions she actually spoke in (a transcript was saved), newest first. */
export function history(opts: { scenarioId?: string; limit?: number } = {}): HistoryItem[] {
  const rows = db()
    .prepare(
      `SELECT * FROM sessions WHERE transcript IS NOT NULL ${opts.scenarioId ? "AND scenario_id = ?" : ""}
       ORDER BY started_at DESC LIMIT ?`,
    )
    .all(...(opts.scenarioId ? [opts.scenarioId] : []), opts.limit ?? 200) as SessionRow[];
  return rows.map((r) => {
    const fb = r.feedback ? (JSON.parse(r.feedback) as Feedback) : null;
    return {
      id: r.id,
      scenarioId: r.scenario_id,
      startedAt: r.started_at,
      durationS: r.duration_s,
      status: fb ? "done" : r.debrief_status === "pending" ? "pending" : "error",
      errors: fb?.errors?.length ?? 0,
      wordsUsed: fb?.words?.filter((w) => w.status === "used_alone").length ?? 0,
    };
  });
}
