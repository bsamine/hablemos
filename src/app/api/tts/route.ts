import { track } from "@/lib/activity";
import { isAuthed } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { carlaSays, isSpeechCached, wavResponse } from "@/lib/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/tts?t=<text>&lang=es|fr → Carla saying it with a native accent (WAV, cached). */
export async function GET(req: Request) {
  if (!(await isAuthed())) return new Response("unauthorized", { status: 401 });
  const q = new URL(req.url).searchParams;
  const t = (q.get("t") ?? "").trim();
  const lang = q.get("lang") === "fr" ? "fr" : "es";
  if (!t || t.length > 600) return new Response("texte invalide", { status: 400 });
  track("play", lang, { cached: isSpeechCached(t, lang), chars: t.length });
  try {
    return wavResponse(await carlaSays(t, lang));
  } catch (e) {
    logError("tts", e, { lang, chars: t.length });
    return new Response("voix indisponible", { status: 502 });
  }
}
