import { db, type WordRow } from "./db";
import type { Feedback } from "./prompts";
import type { Scenario } from "./scenarios";

// Days until next review for each stage (0 = new). Stage 6 = mastered.
const INTERVALS = [1, 1, 2, 4, 7, 15, 30];
export const MASTERED_STAGE = 6;

const nowIso = () => new Date().toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

export function dueWords(limit = 3): WordRow[] {
  return db()
    .prepare("SELECT * FROM words WHERE due_at <= ? AND stage < ? ORDER BY due_at ASC LIMIT ?")
    .all(nowIso(), MASTERED_STAGE, limit) as WordRow[];
}

export function knownErrors(limit = 4): string[] {
  const rows = db()
    .prepare(
      `SELECT category, COUNT(*) AS n, MAX(learner_said) AS ex, MAX(correction) AS fix
       FROM errors WHERE created_at >= ? GROUP BY category ORDER BY n DESC LIMIT ?`,
    )
    .all(inDays(-30), limit) as { category: string; n: number; ex: string; fix: string }[];
  return rows.map((r) => `${r.category} (${r.n}×), ex. « ${r.ex} » → « ${r.fix} »`);
}

function upsertWord(word: string, translation: string, example: string) {
  db()
    .prepare(
      `INSERT INTO words (word, translation, example, stage, due_at, times_used, created_at)
       VALUES (?, ?, ?, 0, ?, 0, ?)
       ON CONFLICT(word) DO UPDATE SET
         translation = CASE WHEN excluded.translation <> '' THEN excluded.translation ELSE words.translation END,
         example = CASE WHEN words.example = '' THEN excluded.example ELSE words.example END`,
    )
    .run(word, translation, example, inDays(1), nowIso());
}

function review(word: string, status: "used_alone" | "used_with_help" | "not_used") {
  const row = db().prepare("SELECT * FROM words WHERE word = ?").get(word) as WordRow | undefined;
  if (!row) return;
  let stage = row.stage;
  if (status === "used_alone") stage = Math.min(MASTERED_STAGE, stage + 1);
  else if (status === "not_used") stage = Math.max(0, stage - 1);
  const used = status === "not_used" ? 0 : 1;
  const days = status === "used_alone" ? INTERVALS[Math.min(stage, INTERVALS.length - 1)] : 1;
  db()
    .prepare("UPDATE words SET stage = ?, due_at = ?, times_used = times_used + ? WHERE word = ?")
    .run(stage, inDays(days), used, word);
}

/** Store the debrief: words (new + reviewed) and errors. */
export function applyFeedback(sessionId: number, scenario: Scenario, fb: Feedback) {
  const tx = db().transaction(() => {
    for (const w of scenario.words) upsertWord(w.word, w.fr, w.example);
    for (const w of fb.new_words ?? []) if (w.word) upsertWord(w.word, w.translation_fr ?? "", w.example ?? "");
    for (const w of fb.words ?? []) if (w.word) review(w.word, w.status);
    const ins = db().prepare(
      "INSERT INTO errors (session_id, category, learner_said, correction, rule_fr, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const e of fb.errors ?? []) ins.run(sessionId, e.category ?? "other", e.learner_said ?? "", e.correction ?? "", e.rule_fr ?? "", nowIso());
  });
  tx();
}

export function stats() {
  const d = db();
  const one = <T,>(sql: string, ...p: unknown[]) => d.prepare(sql).get(...p) as T;
  const sessions = one<{ n: number; s: number | null }>("SELECT COUNT(*) n, SUM(duration_s) s FROM sessions WHERE feedback IS NOT NULL");
  const words = one<{ n: number }>("SELECT COUNT(*) n FROM words");
  const mastered = one<{ n: number }>("SELECT COUNT(*) n FROM words WHERE stage >= ?", MASTERED_STAGE);
  const due = one<{ n: number }>("SELECT COUNT(*) n FROM words WHERE due_at <= ? AND stage < ?", nowIso(), MASTERED_STAGE);
  const days = d
    .prepare("SELECT DISTINCT substr(started_at, 1, 10) day FROM sessions WHERE feedback IS NOT NULL ORDER BY day DESC LIMIT 60")
    .all() as { day: string }[];
  // streak: consecutive days ending today or yesterday
  let streak = 0;
  const cursor = new Date();
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  const set = new Set(days.map((r) => r.day));
  if (!set.has(fmt(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (set.has(fmt(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    sessions: sessions.n,
    minutes: Math.round((sessions.s ?? 0) / 60),
    words: words.n,
    mastered: mastered.n,
    due: due.n,
    streak,
  };
}

export function doneScenarioIds(): Set<string> {
  const rows = db().prepare("SELECT DISTINCT scenario_id FROM sessions WHERE feedback IS NOT NULL").all() as { scenario_id: string }[];
  return new Set(rows.map((r) => r.scenario_id));
}
