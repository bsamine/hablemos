import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { createLiveToken } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/** Diagnostic only: mint a Live token for a given API version + model. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { apiVersion, model } = (await req.json()) as { apiVersion: string; model: string };
  try {
    return NextResponse.json({ token: await createLiveToken(apiVersion, model) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
