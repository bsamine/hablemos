"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { speakEs } from "@/lib/audio";

export function Say({ text }: { text: string }) {
  return (
    <button className="play" onClick={() => speakEs(text)} aria-label="Écouter">
      ▶
    </button>
  );
}

export function Retry({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          const res = await fetch(`/api/sessions/${id}/end`, { method: "POST" });
          if (res.ok) router.refresh();
          else setErr((await res.json().catch(() => ({}))).error ?? "Échec");
          setBusy(false);
        }}
      >
        {busy ? "Analyse en cours…" : "Créer le bilan"}
      </button>
      {err && <p className="error">{err}</p>}
    </>
  );
}
