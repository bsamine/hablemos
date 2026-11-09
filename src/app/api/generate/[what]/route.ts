import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { generateCoachNote, generateGrammarCard, generatePodcast, generateWeekPlan } from "@/lib/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const CATEGORIES = ["verb_conjugation", "gender_agreement", "ser_estar", "word_order", "gustar", "preposition", "vocabulary"];

/** On-demand generation of the week's plan, coach note, podcast or a grammar card. */
export async function POST(req: Request, ctx: { params: Promise<{ what: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { what } = await ctx.params;
  try {
    switch (what) {
      case "plan":
        return NextResponse.json(await generateWeekPlan());
      case "coach":
        return NextResponse.json(await generateCoachNote());
      case "podcast":
        return NextResponse.json(await generatePodcast());
      case "grammar": {
        const cat = new URL(req.url).searchParams.get("cat") ?? "";
        if (!CATEGORIES.includes(cat)) return NextResponse.json({ error: "catégorie inconnue" }, { status: 400 });
        return NextResponse.json(await generateGrammarCard(cat));
      }
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
