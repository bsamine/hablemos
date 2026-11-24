import { db } from "./db";

/** What she does in the app (pages, sessions, plays), to understand real use. Never throws. */
export function track(kind: string, target = "", detail?: unknown) {
  try {
    db()
      .prepare("INSERT INTO activity (at, kind, target, detail) VALUES (?, ?, ?, ?)")
      .run(
        new Date().toISOString(),
        kind.slice(0, 40),
        target.slice(0, 200),
        detail === undefined ? "" : JSON.stringify(detail).slice(0, 1000),
      );
    db().prepare("DELETE FROM activity WHERE at < ?").run(new Date(Date.now() - 365 * 86400_000).toISOString());
  } catch (e) {
    console.error("track failed", e);
  }
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Accueil",
  "/lecons": "Leçons",
  "/progres": "Progrès",
  "/profil": "Profil",
  "/historique": "Historique",
  "/mots": "Mes mots",
  "/suivi": "Suivi",
  "/pratique/hasard": "Conversation au hasard",
  "/pratique/revision": "Révision express",
};
export function pageLabel(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  if (path.startsWith("/session/")) return "Leçon";
  if (path.startsWith("/feedback/")) return "Bilan";
  if (path.startsWith("/pratique/refaire")) return "Redire mes corrections";
  return path;
}

export function activityReport(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const pages = db()
    .prepare("SELECT target, COUNT(*) n FROM activity WHERE kind = 'page' AND at >= ? GROUP BY target ORDER BY n DESC")
    .all(since) as { target: string; n: number }[];
  const grouped = new Map<string, number>();
  for (const p of pages) grouped.set(pageLabel(p.target), (grouped.get(pageLabel(p.target)) ?? 0) + p.n);

  const modes = db()
    .prepare(
      `SELECT COALESCE(mode, 'scenario') mode, COALESCE(length, '') length,
              SUM(CASE WHEN transcript IS NOT NULL THEN 1 ELSE 0 END) started,
              SUM(CASE WHEN feedback IS NOT NULL THEN 1 ELSE 0 END) finished,
              COALESCE(SUM(duration_s), 0) seconds
       FROM sessions WHERE started_at >= ? GROUP BY 1, 2 HAVING started > 0 ORDER BY started DESC`,
    )
    .all(since) as { mode: string; length: string; started: number; finished: number; seconds: number }[];

  const hours = db()
    .prepare(
      "SELECT started_at FROM sessions WHERE started_at >= ? AND transcript IS NOT NULL",
    )
    .all(since) as { started_at: string }[];
  const byHour = new Array(24).fill(0) as number[];
  for (const h of hours) {
    const hour = Number(new Date(h.started_at).toLocaleString("en-US", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false })) % 24;
    byHour[hour]++;
  }

  const counts = db()
    .prepare("SELECT kind, COUNT(*) n FROM activity WHERE at >= ? AND kind <> 'page' GROUP BY kind")
    .all(since) as { kind: string; n: number }[];
  const activeDays = db()
    .prepare("SELECT COUNT(DISTINCT substr(at, 1, 10)) n FROM activity WHERE at >= ?")
    .get(since) as { n: number };

  return {
    days,
    activeDays: activeDays.n,
    pages: [...grouped.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    modes,
    byHour,
    counts: Object.fromEntries(counts.map((c) => [c.kind, c.n])) as Record<string, number>,
  };
}
