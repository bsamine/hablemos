import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";
import { carlaVoice, generateSpeech, TTS_STYLES } from "./gemini";
import { getProfile } from "./profile";

const DIR = path.join(DATA_DIR, "tts");
const g = globalThis as unknown as { __ttsJobs?: Map<string, Promise<Buffer>> };
const jobs = (g.__ttsJobs ??= new Map());

export type SpeechLang = keyof typeof TTS_STYLES;

/** Spanish keeps the original cache key (no style), so audio generated before v0.3 is reused. */
const styleFor = (lang: SpeechLang) => (lang === "es" ? undefined : TTS_STYLES[lang]);

function fileFor(text: string, style?: string): string {
  const voice = carlaVoice(getProfile().voice);
  const key = crypto.createHash("sha1").update(`${voice}|${style ?? ""}|${text}`).digest("hex");
  return path.join(DIR, `${key}.wav`);
}

export function isSpeechCached(text: string, lang: SpeechLang = "es"): boolean {
  return fs.existsSync(fileFor(text, styleFor(lang)));
}

/** Carla saying a text in Spanish or French, with the matching native accent. */
export function carlaSays(text: string, lang: SpeechLang = "es"): Promise<Buffer> {
  return carlaSpeech(text, styleFor(lang));
}

/** Generate in the background the audio a page is about to offer, so ▶ plays at once. Sequential, errors ignored. */
export function warmSpeech(texts: string[], lang: SpeechLang = "es"): void {
  const todo = [...new Set(texts.map((t) => t?.trim()).filter((t): t is string => !!t && t.length <= 600))].filter(
    (t) => !isSpeechCached(t, lang),
  );
  if (!todo.length || !process.env.GEMINI_API_KEY) return;
  void (async () => {
    for (const t of todo.slice(0, 20)) {
      try {
        await carlaSays(t, lang);
      } catch (e) {
        console.warn("warmSpeech:", e instanceof Error ? e.message : e);
        return; // Gemini is unhappy: stop, the ▶ button will try again on demand
      }
    }
  })();
}

/** Carla's voice for a text: generated once with Gemini TTS, then served from disk. */
export async function carlaSpeech(text: string, style?: string): Promise<Buffer> {
  const voice = carlaVoice(getProfile().voice);
  const key = crypto.createHash("sha1").update(`${voice}|${style ?? ""}|${text}`).digest("hex");
  const file = path.join(DIR, `${key}.wav`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (!jobs.has(key)) {
    jobs.set(
      key,
      generateSpeech(text, voice, style)
        .then((wav) => {
          fs.mkdirSync(DIR, { recursive: true });
          fs.writeFileSync(file, wav);
          return wav;
        })
        .finally(() => jobs.delete(key)),
    );
  }
  return jobs.get(key)!;
}

export const wavResponse = (wav: Buffer) =>
  new Response(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=2592000" } });
