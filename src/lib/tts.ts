import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";
import { carlaVoice, generateSpeech } from "./gemini";
import { getProfile } from "./profile";

const DIR = path.join(DATA_DIR, "tts");
const g = globalThis as unknown as { __ttsJobs?: Map<string, Promise<Buffer>> };
const jobs = (g.__ttsJobs ??= new Map());

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
