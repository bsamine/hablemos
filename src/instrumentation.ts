/** Runs once when the server starts: background maintenance for the Node runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { safeSweep } = await import("./lib/sweeper");
  const { checkModels } = await import("./lib/models");
  const g = globalThis as unknown as { __hablemosTimers?: boolean };
  if (g.__hablemosTimers) return;
  g.__hablemosTimers = true;

  safeSweep();
  setInterval(safeSweep, 5 * 60_000).unref();
  if (process.env.NODE_ENV === "production") {
    void checkModels();
    setInterval(() => void checkModels(), 24 * 3600_000).unref();
  }
}
