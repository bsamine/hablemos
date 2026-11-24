import { labGuard } from "@/lib/features";
import { isAuthed } from "@/lib/auth";
import { getCache, todayKey } from "@/lib/cache";
import type { Podcast } from "@/lib/generate";
import { carlaSpeech, wavResponse } from "@/lib/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Today's podcast read by Carla (generated once, cached). */
export async function GET() {
  if (!(await isAuthed())) return new Response("unauthorized", { status: 401 });
  const lab = labGuard();
  if (lab) return lab;
  const p = getCache<Podcast>(`podcast:${todayKey()}`);
  if (!p) return new Response("pas d'épisode aujourd'hui", { status: 404 });
  try {
    return wavResponse(
      await carlaSpeech(
        `${p.title_es}.\n\n${p.text_es}`,
        "Eres Carla, una profesora de Madrid que lee un pequeño pódcast para su alumna. Lee en español de España con voz clara, cálida y bien articulada, a un ritmo tranquilo, con pausas naturales entre frases",
      ),
    );
  } catch (e) {
    console.error("podcast tts failed:", e instanceof Error ? e.message : e);
    return new Response("voix indisponible", { status: 502 });
  }
}
