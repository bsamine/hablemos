import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { LIVE_MODEL } from "@/lib/gemini";
import { recordLiveUsage } from "@/lib/usage";
import { db } from "@/lib/db";
import { getSession } from "@/lib/debrief";
import { cleanTurns, longerTranscript } from "@/lib/transcript";

export const dynamic = "force-dynamic";

/**
 * Save the transcript while the session is running (every few turns, and when the page is
 * hidden or closed, via sendBeacon). If the phone locks or Safari kills the tab, the session is
 * not lost: the sweeper closes it and debriefs what was said.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const row = getSession(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.feedback || row.ended_at) return NextResponse.json({ ok: true, ignored: true });

  const body = (await req.json().catch(() => ({}))) as { transcript?: unknown; durationS?: number; usage?: unknown };
  const turns = cleanTurns(body.transcript);
  if (!turns) return NextResponse.json({ error: "bad transcript" }, { status: 400 });
  if (body.usage) recordLiveUsage(id, LIVE_MODEL, body.usage);
  db()
    .prepare("UPDATE sessions SET transcript = ?, duration_s = MAX(COALESCE(duration_s, 0), ?), last_seen_at = ? WHERE id = ?")
    .run(
      JSON.stringify(longerTranscript(row.transcript, turns)),
      Math.max(0, Math.round(Number(body.durationS) || 0)),
      new Date().toISOString(),
      id,
    );
  return NextResponse.json({ ok: true });
}
