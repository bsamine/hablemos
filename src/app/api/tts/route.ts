import { isAuthed } from "@/lib/auth";
import { carlaSpeech, wavResponse } from "@/lib/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/tts?t=<spanish text> → Carla saying it (WAV, cached). */
export async function GET(req: Request) {
  if (!(await isAuthed())) return new Response("unauthorized", { status: 401 });
  const t = (new URL(req.url).searchParams.get("t") ?? "").trim();
  if (!t || t.length > 600) return new Response("texte invalide", { status: 400 });
  try {
    return wavResponse(await carlaSpeech(t));
  } catch (e) {
    console.error("tts failed:", e instanceof Error ? e.message : e);
    return new Response("voix indisponible", { status: 502 });
  }
}
