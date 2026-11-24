import { notFound } from "next/navigation";
import type { Mode } from "./modes";

/**
 * "Labo": everything outside the core loop (daily lesson → feedback → word review).
 * Hidden unless FEATURES_LAB=1, so the pilot stays focused and each extra feature
 * can be switched back on once the core loop is proven.
 */
export function labEnabled(): boolean {
  return process.env.FEATURES_LAB === "1";
}

/** Session modes that are always available. */
export const CORE_MODES: readonly Mode[] = ["scenario", "redo", "review"];

export function modeAllowed(mode: Mode): boolean {
  return labEnabled() || CORE_MODES.includes(mode);
}

/** For lab pages: behave as if the page didn't exist when the lab is off. */
export function requireLab(): void {
  if (!labEnabled()) notFound();
}

/** For lab API routes: a 404 response when the lab is off, otherwise null. */
export function labGuard(): Response | null {
  return labEnabled() ? null : Response.json({ error: "not found" }, { status: 404 });
}
