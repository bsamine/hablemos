import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { createLiveToken, LIVE_API_VERSION, LIVE_MODEL, liveConfig, VOICE } from "@/lib/gemini";
import { dueWords, knownErrors } from "@/lib/learning";
import { buildTutorPrompt } from "@/lib/prompts";
import { getScenario } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

/** Start a session: build the tutor prompt and mint a one-use Live token. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { scenarioId } = (await req.json()) as { scenarioId?: string };
  const scenario = scenarioId ? getScenario(scenarioId) : undefined;
  if (!scenario) return NextResponse.json({ error: "unknown scenario" }, { status: 400 });

  const level = process.env.LEARNER_LEVEL ?? "A1";
  const minutes = Number(process.env.SESSION_MINUTES ?? 15);
  const targetWordList = scenario.words.map((w) => w.word);
  const review = dueWords(3).filter((w) => !targetWordList.includes(w.word));
  const systemInstruction = buildTutorPrompt({
    scenario,
    level,
    minutes,
    reviewWords: review.map((w) => ({ word: w.word, translation: w.translation })),
    knownErrors: knownErrors(),
  });

  let token: string;
  try {
    token = await createLiveToken(LIVE_API_VERSION, LIVE_MODEL, liveConfig(systemInstruction));
  } catch (e) {
    console.error("token error", e);
    return NextResponse.json({ error: "Impossible de contacter Gemini. Vérifie la clé API." }, { status: 502 });
  }

  const info = db()
    .prepare("INSERT INTO sessions (scenario_id, started_at, target_words, review_words) VALUES (?, ?, ?, ?)")
    .run(scenario.id, new Date().toISOString(), JSON.stringify(targetWordList), JSON.stringify(review.map((w) => w.word)));

  return NextResponse.json({
    sessionId: Number(info.lastInsertRowid),
    token,
    model: LIVE_MODEL,
    apiVersion: LIVE_API_VERSION,
    voice: VOICE,
    minutes,
    systemInstruction,
  });
}
