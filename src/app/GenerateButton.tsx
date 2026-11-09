"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Calls a generation endpoint (10–40 s), then refreshes the page to show the result. */
export default function GenerateButton({
  url,
  label,
  busyLabel = "Carla prépare…",
  variant = "primary",
}: {
  url: string;
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [t, setT] = useState(0);
  return (
    <div className="stack">
      <button
        className={variant}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setT(0);
          const timer = setInterval(() => setT((x) => x + 1), 1000);
          const res = await fetch(url, { method: "POST" }).catch(() => null);
          clearInterval(timer);
          const d = res ? await res.json().catch(() => ({})) : {};
          setBusy(false);
          if (res?.ok) router.refresh();
          else setError(d.error ?? "La génération a échoué. Réessaie dans un moment.");
        }}
      >
        {busy ? `${busyLabel} ${t}s` : label}
      </button>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
