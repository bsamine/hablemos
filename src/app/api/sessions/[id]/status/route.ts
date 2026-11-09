import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getSession, isStale } from "@/lib/debrief";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const row = getSession(Number((await ctx.params).id));
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const status = row.feedback ? "done" : isStale(row) ? "stale" : (row.debrief_status ?? "none");
  return NextResponse.json({ status, error: row.debrief_error });
}
