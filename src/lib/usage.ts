import { db } from "./db";

/**
 * Gemini usage, per call or per live session, with an estimated cost.
 * Prices are in USD per million tokens and can be overridden in .env (Google changes them):
 * the figures are an ESTIMATE to watch the budget, not an invoice.
 */
const price = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 && process.env[name] !== undefined && process.env[name] !== "" ? v : fallback;
};
export function prices() {
  return {
    liveTextIn: price("PRICE_LIVE_TEXT_IN", 0.5),
    liveAudioIn: price("PRICE_LIVE_AUDIO_IN", 3),
    liveTextOut: price("PRICE_LIVE_TEXT_OUT", 2),
    liveAudioOut: price("PRICE_LIVE_AUDIO_OUT", 12),
    textIn: price("PRICE_TEXT_IN", 0.3),
    audioIn: price("PRICE_TEXT_AUDIO_IN", 1),
    textOut: price("PRICE_TEXT_OUT", 2.5),
    ttsIn: price("PRICE_TTS_IN", 0.5),
    ttsOut: price("PRICE_TTS_OUT", 10),
    imageOut: price("PRICE_IMAGE_OUT", 30),
    eurPerUsd: price("EUR_PER_USD", 0.92),
  };
}

export type UsageKind = "live" | "debrief" | "generate" | "voice" | "tts" | "image";
export const USAGE_LABELS: Record<string, string> = {
  live: "Conversations avec Carla",
  debrief: "Bilans de séance",
  generate: "Contenus générés",
  voice: "Analyses vocales",
  tts: "Voix de Carla (▶)",
  image: "Images",
};

export type Tokens = { input: number; output: number; inputAudio: number; outputAudio: number };

type ModalityCount = { modality?: string; tokenCount?: number };
/** The usageMetadata shape shared by generateContent and Live messages (fields vary by API). */
export type UsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  responseTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
  promptTokensDetails?: ModalityCount[];
  candidatesTokensDetails?: ModalityCount[];
  responseTokensDetails?: ModalityCount[];
};

const audioOf = (d?: ModalityCount[]) =>
  (d ?? []).filter((x) => String(x.modality ?? "").toUpperCase() === "AUDIO").reduce((n, x) => n + (x.tokenCount ?? 0), 0);

/** Normalise a usageMetadata object to input/output tokens (thinking counts as output). */
export function tokensOf(u: UsageMetadata | undefined | null): Tokens {
  if (!u) return { input: 0, output: 0, inputAudio: 0, outputAudio: 0 };
  const input = u.promptTokenCount ?? 0;
  let output = (u.candidatesTokenCount ?? u.responseTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  if (!output && u.totalTokenCount) output = Math.max(0, u.totalTokenCount - input);
  return {
    input,
    output,
    inputAudio: Math.min(input, audioOf(u.promptTokensDetails)),
    outputAudio: Math.min(output, audioOf(u.candidatesTokensDetails ?? u.responseTokensDetails)),
  };
}

export function addTokens(a: Tokens, b: Tokens): Tokens {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    inputAudio: a.inputAudio + b.inputAudio,
    outputAudio: a.outputAudio + b.outputAudio,
  };
}

/** Estimated cost in USD. */
export function costOf(kind: string, t: Tokens): number {
  const p = prices();
  const M = 1_000_000;
  const textIn = t.input - t.inputAudio;
  const textOut = t.output - t.outputAudio;
  switch (kind) {
    case "live":
      return (textIn * p.liveTextIn + t.inputAudio * p.liveAudioIn + textOut * p.liveTextOut + t.outputAudio * p.liveAudioOut) / M;
    case "tts":
      return (t.input * p.ttsIn + t.output * p.ttsOut) / M;
    case "image":
      return (t.input * p.textIn + t.output * p.imageOut) / M;
    default:
      return (textIn * p.textIn + t.inputAudio * p.audioIn + t.output * p.textOut) / M;
  }
}

/** Record one server-side Gemini call. Never throws: usage tracking must not break a feature. */
export function recordUsage(kind: UsageKind, model: string, meta: UsageMetadata | undefined | null, sessionId?: number | null) {
  try {
    const t = tokensOf(meta);
    if (!t.input && !t.output) return;
    db()
      .prepare(
        `INSERT INTO usage (at, kind, model, session_id, input_tokens, output_tokens, input_audio_tokens, output_audio_tokens, cost_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(new Date().toISOString(), kind, model, sessionId ?? null, t.input, t.output, t.inputAudio, t.outputAudio, costOf(kind, t));
  } catch (e) {
    console.error("recordUsage failed", e);
  }
}

/** Live sessions report their running total from the browser: one row per session, only ever growing. */
export function recordLiveUsage(sessionId: number, model: string, raw: unknown) {
  try {
    const t = sanitizeTokens(raw);
    if (!t || (!t.input && !t.output)) return;
    const cost = costOf("live", t);
    db()
      .prepare(
        `INSERT INTO usage (at, kind, model, session_id, input_tokens, output_tokens, input_audio_tokens, output_audio_tokens, cost_usd)
         VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) WHERE kind = 'live' DO UPDATE SET
           input_tokens = MAX(usage.input_tokens, excluded.input_tokens),
           output_tokens = MAX(usage.output_tokens, excluded.output_tokens),
           input_audio_tokens = MAX(usage.input_audio_tokens, excluded.input_audio_tokens),
           output_audio_tokens = MAX(usage.output_audio_tokens, excluded.output_audio_tokens),
           cost_usd = MAX(usage.cost_usd, excluded.cost_usd)`,
      )
      .run(new Date().toISOString(), model, sessionId, t.input, t.output, t.inputAudio, t.outputAudio, cost);
  } catch (e) {
    console.error("recordLiveUsage failed", e);
  }
}

/** Tokens sent by the browser: whole, non-negative, bounded numbers only. */
export function sanitizeTokens(raw: unknown): Tokens | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) && x > 0 ? Math.min(x, 50_000_000) : 0;
  };
  const t = { input: n(r.input), output: n(r.output), inputAudio: n(r.inputAudio), outputAudio: n(r.outputAudio) };
  t.inputAudio = Math.min(t.inputAudio, t.input);
  t.outputAudio = Math.min(t.outputAudio, t.output);
  return t;
}

// ---------- reports ----------

export type UsageTotals = { tokens: number; costUsd: number; costEur: number; calls: number };

function totals(sinceIso: string, untilIso?: string): UsageTotals {
  const r = db()
    .prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) tokens, COALESCE(SUM(cost_usd), 0) cost, COUNT(*) calls
       FROM usage WHERE at >= ? AND at < ?`,
    )
    .get(sinceIso, untilIso ?? "9999") as { tokens: number; cost: number; calls: number };
  return { tokens: r.tokens, costUsd: r.cost, costEur: r.cost * prices().eurPerUsd, calls: r.calls };
}

const parisDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
/** Midnight Paris time of the day containing `d`, as an ISO string (approximate across DST: good enough for reports). */
function startOfParisDay(d: Date): Date {
  const day = parisDay(d);
  const probe = new Date(`${day}T12:00:00Z`);
  const offsetH = Number(probe.toLocaleString("en-US", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false })) - 12;
  return new Date(Date.parse(`${day}T00:00:00Z`) - offsetH * 3600_000);
}

export function usageSummary(now = new Date()) {
  const today = startOfParisDay(now);
  const week = new Date(today.getTime() - 6 * 86400_000);
  const monthStart = startOfParisDay(new Date(`${parisDay(now).slice(0, 7)}-01T12:00:00Z`));
  const byKind = db()
    .prepare(
      `SELECT kind, COALESCE(SUM(input_tokens + output_tokens), 0) tokens, COALESCE(SUM(cost_usd), 0) cost, COUNT(*) calls
       FROM usage WHERE at >= ? GROUP BY kind ORDER BY cost DESC`,
    )
    .all(monthStart.toISOString()) as { kind: string; tokens: number; cost: number; calls: number }[];
  return {
    today: totals(today.toISOString()),
    week: totals(week.toISOString()),
    month: totals(monthStart.toISOString()),
    byKind: byKind.map((k) => ({ ...k, label: USAGE_LABELS[k.kind] ?? k.kind, costEur: k.cost * prices().eurPerUsd })),
    budgetEur: Number(process.env.MONTHLY_BUDGET_EUR ?? 15),
  };
}

/** Per day (Paris), last `days` days: sessions, minutes spoken, tokens, estimated cost. */
export function dailyUsage(days = 14, now = new Date()) {
  const out: { day: string; sessions: number; minutes: number; tokens: number; costEur: number }[] = [];
  const eur = prices().eurPerUsd;
  for (let i = days - 1; i >= 0; i--) {
    const start = startOfParisDay(new Date(now.getTime() - i * 86400_000));
    const end = new Date(start.getTime() + 86400_000);
    const s = db()
      .prepare(
        "SELECT COUNT(*) n, COALESCE(SUM(duration_s), 0) d FROM sessions WHERE started_at >= ? AND started_at < ? AND transcript IS NOT NULL",
      )
      .get(start.toISOString(), end.toISOString()) as { n: number; d: number };
    const u = totals(start.toISOString(), end.toISOString());
    out.push({ day: parisDay(start), sessions: s.n, minutes: Math.round(s.d / 60), tokens: u.tokens, costEur: u.costUsd * eur });
  }
  return out;
}

export function sessionUsage(sessionId: number): { tokens: number; costEur: number } {
  const r = db()
    .prepare("SELECT COALESCE(SUM(input_tokens + output_tokens), 0) tokens, COALESCE(SUM(cost_usd), 0) cost FROM usage WHERE session_id = ?")
    .get(sessionId) as { tokens: number; cost: number };
  return { tokens: r.tokens, costEur: r.cost * prices().eurPerUsd };
}

export const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 1000 ? `${Math.round(n / 1000)} k` : String(n);
export const fmtEur = (n: number) => `${n < 0.1 && n > 0 ? n.toFixed(3) : n.toFixed(2)} €`.replace(".", ",");
