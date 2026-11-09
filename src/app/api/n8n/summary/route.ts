import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stats } from "@/lib/learning";
import { getProfile } from "@/lib/profile";
import { progress } from "@/lib/progress";
import { ERROR_LABELS } from "@/lib/prompts";

export const dynamic = "force-dynamic";

/**
 * For automations (n8n): daily reminder, weekly summary, alerts.
 * GET /api/n8n/summary with header "x-api-key: <N8N_API_KEY>" (or ?key=).
 */
export async function GET(req: Request) {
  const expected = process.env.N8N_API_KEY ?? "";
  const given = req.headers.get("x-api-key") ?? new URL(req.url).searchParams.get("key") ?? "";
  const ok =
    expected.length >= 16 &&
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const s = stats();
  const p = progress();
  const profile = getProfile();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // YYYY-MM-DD
  const last = db()
    .prepare("SELECT started_at FROM sessions WHERE transcript IS NOT NULL ORDER BY started_at DESC LIMIT 1")
    .get() as { started_at: string } | undefined;
  const lastDay = last ? new Date(last.started_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }) : null;
  const failed = db()
    .prepare(
      "SELECT id, started_at, debrief_error FROM sessions WHERE debrief_status = 'error' AND started_at >= ? ORDER BY started_at DESC",
    )
    .all(new Date(Date.now() - 2 * 86400_000).toISOString()) as { id: number; started_at: string; debrief_error: string }[];
  const thisWeek = p.weeks.at(-1)!;
  const lastWeekMin = p.weeks.at(-2)!.minutes;
  const name = profile.name || "";
  const url = `https://${process.env.APP_HOST ?? ""}`;
  const topErr = p.errors.slice(0, 3).map((e) => ERROR_LABELS[e.category] ?? e.category);
  const reminder =
    `¡Hola${name ? ` ${name}` : ""}! Carla t'attend 🙂 ` +
    (s.due ? `${Math.min(s.due, 8)} mots à revoir en 4 minutes, ` : "") +
    `ou une leçon de 15 min. Série en cours : ${s.streak} jour${s.streak > 1 ? "s" : ""}. ${url}`;
  const sunday =
    `Ta semaine en espagnol${name ? `, ${name}` : ""} : ${thisWeek.minutes} min parlées (${thisWeek.minutes >= lastWeekMin ? "+" : ""}${thisWeek.minutes - lastWeekMin} vs la semaine dernière), ` +
    `${thisWeek.sessions} séance${thisWeek.sessions > 1 ? "s" : ""}, ${s.mastered} mots maîtrisés. ` +
    (topErr.length ? `À surveiller : ${topErr.join(", ")}. ` : "") +
    `Prépare ta semaine avec Carla : ${url}`;

  return NextResponse.json({
    learner: profile.name || null,
    level: profile.level,
    practicedToday: lastDay === today,
    lastSessionAt: last?.started_at ?? null,
    streak: s.streak,
    dueWords: s.due,
    words: { total: s.words, mastered: s.mastered },
    thisWeek: { minutes: thisWeek.minutes, sessions: thisWeek.sessions },
    lastWeek: { minutes: p.weeks.at(-2)!.minutes, sessions: p.weeks.at(-2)!.sessions },
    topErrors: p.errors.slice(0, 3).map((e) => ({ category: ERROR_LABELS[e.category] ?? e.category, last14days: e.recent })),
    failedDebriefs: failed,
    appUrl: url,
    messages: { reminder_fr: reminder, sunday_fr: sunday },
  });
}
