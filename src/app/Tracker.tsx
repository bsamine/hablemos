"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Records which pages she opens (for the Suivi page). No content, no third party. */
export default function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path === "/login") return;
    const body = JSON.stringify({ path });
    try {
      if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" })))
        void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    } catch {
      /* tracking is best-effort */
    }
  }, [path]);
  return null;
}
