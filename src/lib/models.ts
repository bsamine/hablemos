import { LIVE_MODEL, TEXT_MODEL, TTS_MODEL } from "./gemini";
import { logError } from "./errors";

export type ModelCheck = { at: string; missing: string[]; error?: string };
const g = globalThis as unknown as { __hablemosModels?: ModelCheck };

export function lastModelCheck(): ModelCheck | undefined {
  return g.__hablemosModels;
}

/**
 * Check that the configured Gemini models still exist (Google renames Live models often).
 * A missing model is logged to error_log, so the n8n alert reports it the same day.
 */
export async function checkModels(): Promise<ModelCheck> {
  const key = process.env.GEMINI_API_KEY;
  const at = new Date().toISOString();
  if (!key) return (g.__hablemosModels = { at, missing: [], error: "GEMINI_API_KEY is not set" });
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { models?: { name: string }[]; error?: { message?: string } };
    if (!res.ok || !data.models) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
    const names = new Set(data.models.map((m) => m.name.replace(/^models\//, "")));
    const missing = [LIVE_MODEL, TEXT_MODEL, TTS_MODEL].filter((m) => !names.has(m));
    if (missing.length) logError("models", `Modèle(s) Gemini introuvable(s) : ${missing.join(", ")}`);
    return (g.__hablemosModels = { at, missing });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logError("models", `Vérification des modèles impossible : ${error}`);
    return (g.__hablemosModels = { at, missing: [], error });
  }
}
