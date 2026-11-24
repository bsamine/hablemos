import { db } from "./db";

export type ErrorRow = { id: number; at: string; source: string; message: string; detail: string };

/** Log an error to the console and to the error_log table (read by the n8n alert). Never throws. */
export function logError(source: string, err: unknown, detail?: unknown): void {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  const d = detail === undefined ? "" : typeof detail === "string" ? detail : JSON.stringify(detail);
  console.error(`[${source}] ${message}${d ? ` — ${d.slice(0, 300)}` : ""}`);
  try {
    db()
      .prepare("INSERT INTO error_log (at, source, message, detail) VALUES (?, ?, ?, ?)")
      .run(new Date().toISOString(), source.slice(0, 60), message, d.slice(0, 2000));
    // Keep the table small: 90 days is plenty for a single learner.
    db().prepare("DELETE FROM error_log WHERE at < ?").run(new Date(Date.now() - 90 * 86400_000).toISOString());
  } catch (e) {
    console.error("logError: could not write to the database", e);
  }
}

export function recentErrors(sinceMs: number, limit = 20): ErrorRow[] {
  return db()
    .prepare("SELECT * FROM error_log WHERE at >= ? ORDER BY at DESC LIMIT ?")
    .all(new Date(Date.now() - sinceMs).toISOString(), limit) as ErrorRow[];
}
