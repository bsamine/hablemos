import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getVoiceNote, retryVoiceNote } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const n = getVoiceNote(Number((await ctx.params).id));
  if (!n) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ status: n.status, error: n.error, kind: n.kind, result: n.result ? JSON.parse(n.result) : null });
}

/** Retry the analysis of a failed note. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!getVoiceNote(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  retryVoiceNote(id);
  return NextResponse.json({ ok: true });
}
