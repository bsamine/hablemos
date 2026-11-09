import { db, type SessionRow } from "./db";
import { sessionSpec } from "./modes";
import type { Feedback } from "./prompts";

export type HistoryItem = {
  id: number;
  scenarioId: string;
  title: string;
  mode: string;
  startedAt: string;
  durationS: number | null;
  status: "done" | "pending" | "error";
  errors: number;
  wordsUsed: number;
  interviewScore: number | null;
};

/** Sessions she actually spoke in (a transcript was saved), newest first. */
export function history(opts: { scenarioId?: string; modes?: string[]; limit?: number } = {}): HistoryItem[] {
  const where = ["transcript IS NOT NULL"];
  const args: (string | number)[] = [];
  if (opts.scenarioId) {
    where.push("scenario_id = ?");
    args.push(opts.scenarioId);
  }
  if (opts.modes?.length) {
    where.push(`COALESCE(mode, 'scenario') IN (${opts.modes.map(() => "?").join(",")})`);
    args.push(...opts.modes);
  }
  const rows = db()
    .prepare(`SELECT * FROM sessions WHERE ${where.join(" AND ")} ORDER BY started_at DESC LIMIT ?`)
    .all(...args, opts.limit ?? 200) as SessionRow[];
  return rows.map((r) => {
    const fb = r.feedback ? (JSON.parse(r.feedback) as Feedback) : null;
    return {
      id: r.id,
      scenarioId: r.scenario_id,
      title: sessionSpec(r)?.title ?? r.scenario_id,
      mode: r.mode ?? "scenario",
      startedAt: r.started_at,
      durationS: r.duration_s,
      status: fb ? "done" : r.debrief_status === "pending" ? "pending" : "error",
      errors: fb?.errors?.length ?? 0,
      wordsUsed: fb?.words?.filter((w) => w.status === "used_alone").length ?? 0,
      interviewScore: fb?.interview?.criteria?.length
        ? Math.round((fb.interview.criteria.reduce((a, c) => a + (Number(c.score) || 0), 0) / fb.interview.criteria.length) * 10) / 10
        : null,
    };
  });
}
