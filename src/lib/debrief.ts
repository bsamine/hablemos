import { db, type SessionRow } from "./db";
import { generateJson } from "./gemini";
import { applyFeedback, knownErrors } from "./learning";
import { buildDebriefPrompt, type Feedback } from "./prompts";
import { getScenario } from "./scenarios";

export type Turn = { role: "learner" | "tutor"; text: string };

const g = globalThis as unknown as { __hablemosRunning?: Set<number> };
const running = (g.__hablemosRunning ??= new Set<number>());

export function getSession(id: number): SessionRow | undefined {
  return db().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

export function isStale(row: SessionRow): boolean {
  // "pending" but no job in this server process: it was lost (e.g. redeploy) and can be restarted.
  return row.debrief_status === "pending" && !running.has(row.id);
}

/** Start the debrief in the background. Returns immediately; the feedback page polls the status. */
export function startDebrief(id: number): "started" | "running" | "done" | "nothing" {
  const row = getSession(id);
  if (!row) return "nothing";
  if (row.feedback) return "done";
  if (running.has(id)) return "running";
  const turns: Turn[] = row.transcript ? JSON.parse(row.transcript) : [];
  if (!turns.some((t) => t.role === "learner")) {
    db()
      .prepare("UPDATE sessions SET debrief_status = 'error', debrief_error = ? WHERE id = ?")
      .run("Séance trop courte : Lucía ne t'a pas entendue parler.", id);
    return "nothing";
  }
  db()
    .prepare("UPDATE sessions SET debrief_status = 'pending', debrief_error = NULL, debrief_started_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
  running.add(id);
  void run(row, turns).finally(() => running.delete(id));
  return "started";
}

async function run(row: SessionRow, turns: Turn[]) {
  const scenario = getScenario(row.scenario_id);
  try {
    if (!scenario) throw new Error("scénario inconnu");
    const transcript = turns.map((t) => `${t.role === "learner" ? "L" : "T"}: ${t.text.trim()}`).join("\n");
    const prompt = buildDebriefPrompt({
      level: process.env.LEARNER_LEVEL ?? "A1",
      knownErrors: knownErrors(),
      targetWords: JSON.parse(row.target_words),
      reviewWords: JSON.parse(row.review_words),
      scenarioTitle: scenario.title,
      taskGoal: scenario.taskGoal,
      transcript,
    });
    const fb = (await generateJson(prompt)) as Feedback;
    db()
      .prepare("UPDATE sessions SET feedback = ?, debrief_status = 'done', debrief_error = NULL WHERE id = ?")
      .run(JSON.stringify(fb), row.id);
    applyFeedback(row.id, scenario, fb);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`debrief ${row.id} failed:`, msg);
    db().prepare("UPDATE sessions SET debrief_status = 'error', debrief_error = ? WHERE id = ?").run(msg, row.id);
  }
}
