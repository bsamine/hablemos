import { GoogleGenAI } from "@google/genai";

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
export const LIVE_API_VERSION = process.env.GEMINI_LIVE_API_VERSION ?? "v1alpha";
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash";
export const VOICE = process.env.GEMINI_VOICE ?? "Aoede";

export function serverClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey, ...(apiVersion ? { httpOptions: { apiVersion } } : {}) });
}

/** Short-lived token the browser uses to open ONE Live session directly with Gemini. */
export async function createLiveToken(): Promise<string> {
  const ai = serverClient(LIVE_API_VERSION);
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 2 * 60_000).toISOString(),
      liveConnectConstraints: { model: LIVE_MODEL },
      httpOptions: { apiVersion: LIVE_API_VERSION },
    },
  });
  if (!token.name) throw new Error("Gemini returned no token");
  return token.name;
}

export async function generateJson(prompt: string): Promise<unknown> {
  const ai = serverClient();
  const res = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.3 },
  });
  const text = res.text ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}
