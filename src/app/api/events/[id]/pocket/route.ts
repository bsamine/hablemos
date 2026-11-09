import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { generatePocket } from "@/lib/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await generatePocket(Number((await ctx.params).id)));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
