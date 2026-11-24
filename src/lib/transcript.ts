import type { Turn } from "./debrief";

/** Cleans a transcript coming from the browser: known roles, non-empty text, bounded size. */
export function cleanTurns(input: unknown): Turn[] | null {
  if (!Array.isArray(input)) return null;
  return input
    .filter(
      (t): t is Turn =>
        !!t && (t.role === "learner" || t.role === "tutor") && typeof t.text === "string" && !!t.text.trim(),
    )
    .slice(0, 2000)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 4000) }));
}

/** Pick which transcript to keep: never replace a longer saved one with a shorter one (late beacon, retry). */
export function longerTranscript(saved: string | null, incoming: Turn[]): Turn[] {
  const known: Turn[] = saved ? JSON.parse(saved) : [];
  return incoming.length >= known.length ? incoming : known;
}
