import Link from "next/link";
import type { SessionLength } from "@/lib/modes";

/** Two formats every day: a quick 10-minute session or a long 30-minute one. */
export default function LengthPicker({ base, value }: { base: string; value: SessionLength }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <nav className="segmented" aria-label="Durée de la séance">
      <Link href={`${base}${sep}duree=rapide`} className={value === "quick" ? "on" : ""} replace scroll={false}>
        <strong>⚡ Rapide</strong>
        <span>10 min</span>
      </Link>
      <Link href={`${base}${sep}duree=longue`} className={value === "long" ? "on" : ""} replace scroll={false}>
        <strong>🎯 Longue</strong>
        <span>30 min</span>
      </Link>
    </nav>
  );
}
