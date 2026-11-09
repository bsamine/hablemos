import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
export const LIVE_API_VERSION = process.env.GEMINI_LIVE_API_VERSION ?? "v1alpha";
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash";
// Tried in order when the main model is overloaded or unavailable (names from ./scripts/check-models.sh).
export const TEXT_FALLBACK_MODELS = (process.env.GEMINI_TEXT_FALLBACK_MODELS ?? "gemini-3.7-flash,gemini-3.5-flash,gemini-2.5-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
export const VOICE = process.env.GEMINI_VOICE ?? "Aoede";

export function serverClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey, ...(apiVersion ? { httpOptions: { apiVersion } } : {}) });
}

/** The full Live session setup. It is baked into the token: Gemini ignores config sent by the browser. */
export function liveConfig(systemInstruction?: string): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    ...(systemInstruction ? { systemInstruction } : {}),
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: {},
    contextWindowCompression: { slidingWindow: {} },
  };
}

/** Short-lived token the browser uses to open ONE Live session directly with Gemini.
 *  When `config` is given, it is locked into the token (Gemini then ignores the browser's config). */
export async function createLiveToken(
  apiVersion = LIVE_API_VERSION,
  model = LIVE_MODEL,
  config?: LiveConnectConfig,
): Promise<string> {
  const ai = serverClient(apiVersion);
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 2 * 60_000).toISOString(),
      liveConnectConstraints: { model, ...(config ? { config } : {}) },
      httpOptions: { apiVersion },
    },
  });
  if (!token.name) throw new Error("Gemini returned no token");
  return token.name;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isBusy = (msg: string) =>
  /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|aborted|timeout)\b/i.test(msg);

/** Ask a text model for JSON. Each model gets one retry when busy, then the next model is tried. */
export async function generateJson(prompt: string): Promise<unknown> {
  const ai = serverClient("v1beta");
  const errors: string[] = [];
  const attempts = [...new Set([TEXT_MODEL, ...TEXT_FALLBACK_MODELS])].flatMap((m) => [
    { model: m, wait: 0 },
    { model: m, wait: 2500 },
  ]);
  const deadline = Date.now() + 150_000; // whole debrief: 2.5 min max
  for (const { model, wait } of attempts) {
    if (Date.now() > deadline) {
      errors.push("temps total dépassé");
      break;
    }
    if (wait) {
      if (!isBusy(errors.at(-1) ?? "")) continue; // only retry the same model when it was busy
      await sleep(wait);
    }
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 8192,
          abortSignal: AbortSignal.timeout(50_000), // a stuck call must not block the debrief
        },
      });
      const text = res.text ?? "";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error(`réponse sans JSON (${text.slice(0, 120) || "vide"})`);
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`debrief with ${model} failed:`, msg);
      errors.push(`${model}: ${msg.slice(0, 200)}`);
    }
  }
  throw new Error(errors.join(" | "));
}
