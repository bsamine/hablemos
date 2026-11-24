import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { logError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Errors seen in the browser (microphone, Gemini Live), so they reach the n8n alert. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { where?: string; message?: string; detail?: unknown };
  logError(`client:${String(body.where ?? "?").slice(0, 40)}`, String(body.message ?? "").slice(0, 500), {
    detail: body.detail,
    ua: req.headers.get("user-agent")?.slice(0, 200),
  });
  return NextResponse.json({ ok: true });
}
