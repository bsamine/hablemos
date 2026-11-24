/** In-memory login throttle: after MAX_FAILURES wrong codes from one address, wait WINDOW_MS. */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;

type Entry = { failures: number; first: number };
const g = globalThis as unknown as { __hablemosLogin?: Map<string, Entry> };
const store = (g.__hablemosLogin ??= new Map<string, Entry>());

/** The client's address as seen through Caddy (first X-Forwarded-For entry). */
export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function isBlocked(key: string, now = Date.now()): boolean {
  const e = store.get(key);
  if (!e) return false;
  if (now - e.first > WINDOW_MS) {
    store.delete(key);
    return false;
  }
  return e.failures >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  const e = store.get(key);
  if (!e || now - e.first > WINDOW_MS) store.set(key, { failures: 1, first: now });
  else e.failures++;
  if (store.size > 1000) store.clear(); // never grow without bound
}

export function recordSuccess(key: string): void {
  store.delete(key);
}
