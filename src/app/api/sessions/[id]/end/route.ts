import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSession, startDebrief, type Turn } from "@/lib/debrief";

export const dynamic = "force-dynamic";

/** End a session (with the transcript) or retry its debrief (no body). Returns at once. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const row = getSession(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { transcript?: Turn[]; durationS?: number };
  if (body.transcript && !row.feedback) {
    const turns = body.transcript.filter((t) => t.text?.trim());
    db()
      .prepare("UPDATE sessions SET ended_at = ?, duration_s = ?, transcript = ? WHERE id = ?")
      .run(new Date().toISOString(), Math.max(0, Math.round(body.durationS ?? 0)), JSON.stringify(turns), id);
  }
  const state = startDebrief(id);
  return NextResponse.json({ ok: true, sessionId: id, state });
}
