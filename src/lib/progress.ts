import { db, type SessionRow } from "./db";
import { MASTERED_STAGE } from "./learning";
import type { Feedback } from "./prompts";

const DAY = 86400_000;

function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = (x.getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(x.getTime() - wd * DAY);
}

export function progress() {
  const rows = db()
    .prepare("SELECT * FROM sessions WHERE transcript IS NOT NULL ORDER BY started_at ASC")
    .all() as SessionRow[];

  // minutes spoken per week, last 8 weeks
  const thisMonday = mondayOf(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(thisMonday.getTime() - (7 - i) * 7 * DAY);
    return { start, label: start.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }), minutes: 0, sessions: 0 };
  });
  for (const r of rows) {
    const w = weeks.find((x) => {
      const t = Date.parse(r.started_at);
      return t >= x.start.getTime() && t < x.start.getTime() + 7 * DAY;
    });
    if (w) {
      w.minutes += Math.round((r.duration_s ?? 0) / 60);
      w.sessions += 1;
    }
  }

  // words by stage
  const st = db()
    .prepare(
      `SELECT SUM(stage = 0) AS fresh, SUM(stage > 0 AND stage < ?) AS learning, SUM(stage >= ?) AS mastered FROM words`,
    )
    .get(MASTERED_STAGE, MASTERED_STAGE) as { fresh: number | null; learning: number | null; mastered: number | null };

  // error categories: last 14 days vs the 14 days before
  const now = Date.now();
  const iso = (t: number) => new Date(t).toISOString();
  const errs = db()
    .prepare(
      `SELECT category,
              SUM(created_at >= ?) AS recent,
              SUM(created_at < ? AND created_at >= ?) AS before
       FROM errors GROUP BY category ORDER BY recent DESC, before DESC`,
    )
    .all(iso(now - 14 * DAY), iso(now - 14 * DAY), iso(now - 28 * DAY)) as { category: string; recent: number; before: number }[];

  // level estimates from feedback
  const levels = rows
    .filter((r) => r.feedback)
    .slice(-10)
    .map((r) => {
      const fb = JSON.parse(r.feedback!) as Feedback;
      return { date: r.started_at, level: fb.level_signals?.estimated_cefr ?? "?", confidence: fb.level_signals?.confidence ?? "" };
    });

  const totalMinutes = rows.reduce((a, r) => a + Math.round((r.duration_s ?? 0) / 60), 0);
  return {
    weeks,
    words: { fresh: st.fresh ?? 0, learning: st.learning ?? 0, mastered: st.mastered ?? 0 },
    errors: errs.filter((e) => e.recent || e.before),
    levels,
    totals: { sessions: rows.length, minutes: totalMinutes },
  };
}
