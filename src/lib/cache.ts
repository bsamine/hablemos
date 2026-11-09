import { db } from "./db";

/** Small key/value cache for generated content (grammar cards, podcast, plans…). */
export function getCache<T>(key: string, maxAgeMs?: number): T | undefined {
  const r = db().prepare("SELECT value, created_at FROM cache WHERE key = ?").get(key) as
    | { value: string; created_at: string }
    | undefined;
  if (!r) return undefined;
  if (maxAgeMs && Date.now() - Date.parse(r.created_at) > maxAgeMs) return undefined;
  return JSON.parse(r.value) as T;
}

export function setCache(key: string, value: unknown) {
  db()
    .prepare(
      "INSERT INTO cache (key, value, created_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, created_at = excluded.created_at",
    )
    .run(key, JSON.stringify(value), new Date().toISOString());
}

export function delCache(key: string) {
  db().prepare("DELETE FROM cache WHERE key = ?").run(key);
}

/** ISO date of this week's Monday (Paris time), used as a cache key. */
export function weekKey(d = new Date()): string {
  const paris = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const wd = (paris.getDay() + 6) % 7;
  paris.setDate(paris.getDate() - wd);
  return paris.toISOString().slice(0, 10);
}

export function todayKey(d = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}
