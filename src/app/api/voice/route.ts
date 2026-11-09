import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { saveVoiceNote, type VoiceKind } from "@/lib/voice";

export const dynamic = "force-dynamic";
const KINDS: VoiceKind[] = ["missing", "debrief", "diary", "pronunciation"];
const MAX_BYTES = 6 * 1024 * 1024; // ~3 min of 16 kHz WAV

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const f = await req.formData().catch(() => null);
  const kind = String(f?.get("kind") ?? "") as VoiceKind;
  const file = f?.get("audio");
  if (!f || !KINDS.includes(kind) || !(file instanceof Blob)) return NextResponse.json({ error: "requête invalide" }, { status: 400 });
  if (file.size < 2000) return NextResponse.json({ error: "Enregistrement trop court." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Enregistrement trop long (3 min max)." }, { status: 413 });
  const id = saveVoiceNote(kind, String(f.get("ref") ?? ""), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ id });
}
