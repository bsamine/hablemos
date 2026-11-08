import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { db, type SessionRow } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { applyFeedback, knownErrors } from "@/lib/learning";
import { buildDebriefPrompt, type Feedback } from "@/lib/prompts";
import { getScenario } from "@/lib/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Turn = { role: "learner" | "tutor"; text: string };

/** End a session: save the transcript, run the debrief, update words and errors. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(Number(id)) as SessionRow | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const scenario = getScenario(row.scenario_id);
  if (!scenario) return NextResponse.json({ error: "unknown scenario" }, { status: 400 });

  if (row.feedback) return NextResponse.json({ ok: true, sessionId: row.id });

  // A retry (no body) reuses the stored transcript.
  const body = (await req.json().catch(() => ({}))) as { transcript?: Turn[]; durationS?: number };
  let turns: Turn[];
  if (body.transcript) {
    turns = body.transcript.filter((t) => t.text?.trim());
    const durationS = Math.max(0, Math.round(body.durationS ?? 0));
    db()
      .prepare("UPDATE sessions SET ended_at = ?, duration_s = ?, transcript = ? WHERE id = ?")
      .run(new Date().toISOString(), durationS, JSON.stringify(turns), row.id);
  } else {
    turns = row.transcript ? (JSON.parse(row.transcript) as Turn[]) : [];
  }

  if (!turns.some((t) => t.role === "learner")) {
    return NextResponse.json({ error: "Session trop courte : rien à analyser." }, { status: 422 });
  }

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

  let fb: Feedback;
  try {
    fb = (await generateJson(prompt)) as Feedback;
  } catch (e) {
    console.error("debrief error", e);
    return NextResponse.json({ error: "Le bilan a échoué. Réessaie depuis l'historique." }, { status: 502 });
  }
  db().prepare("UPDATE sessions SET feedback = ? WHERE id = ?").run(JSON.stringify(fb), row.id);
  applyFeedback(row.id, scenario, fb);
  return NextResponse.json({ ok: true, sessionId: row.id });
}
