import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { createLiveToken, LIVE_API_VERSION, LIVE_MODEL, liveConfig, VOICE } from "@/lib/gemini";
import { dueWords, knownErrors } from "@/lib/learning";
import { buildSpec, type StartRequest } from "@/lib/modes";
import { getProfile, listFacts, recentNotes } from "@/lib/profile";
import { buildTutorPrompt } from "@/lib/prompts";

export const dynamic = "force-dynamic";

/** Start a session: build Carla's prompt (plan + memory) and mint a one-use Live token. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as StartRequest;
  const spec = buildSpec(body);
  if (!spec) return NextResponse.json({ error: "Cette séance n'est pas disponible." }, { status: 400 });

  const profile = getProfile();
  const targetWordList = spec.words.map((w) => w.word);
  const review = spec.mode === "review" ? [] : dueWords(3).filter((w) => !targetWordList.includes(w.word));
  const systemInstruction = buildTutorPrompt({
    spec,
    level: profile.level,
    reviewWords: review.map((w) => ({ word: w.word, translation: w.translation })),
    knownErrors: knownErrors(),
    learner: {
      name: profile.name,
      about: profile.about,
      facts: listFacts().slice(0, 30).map((f) => f.text),
      notes: recentNotes(3),
    },
    now: new Date(),
  });

  let token: string;
  try {
    token = await createLiveToken(LIVE_API_VERSION, LIVE_MODEL, liveConfig(systemInstruction));
  } catch (e) {
    console.error("token error", e);
    return NextResponse.json({ error: "Impossible de contacter Gemini. Vérifie la clé API." }, { status: 502 });
  }

  const info = db()
    .prepare(
      "INSERT INTO sessions (scenario_id, started_at, target_words, review_words, mode, spec) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      spec.scenarioId ?? spec.mode,
      new Date().toISOString(),
      JSON.stringify(targetWordList),
      JSON.stringify(review.map((w) => w.word)),
      spec.mode,
      JSON.stringify(spec),
    );

  return NextResponse.json({
    sessionId: Number(info.lastInsertRowid),
    token,
    model: LIVE_MODEL,
    apiVersion: LIVE_API_VERSION,
    voice: VOICE,
    minutes: spec.minutes,
    learnerName: profile.name,
  });
}
