"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { speakEs } from "@/lib/audio";

export function Say({ text }: { text: string }) {
  return (
    <button className="play" onClick={() => speakEs(text)} aria-label="Écouter">
      ▶
    </button>
  );
}

type Status = "pending" | "done" | "error" | "stale" | "none";

/** Shown while the debrief runs in the background: polls, then shows the feedback (or a retry button). */
export function Pending({
  id,
  initialStatus,
  initialError,
  hasTranscript,
}: {
  id: number;
  initialStatus: Status;
  initialError: string | null;
  hasTranscript: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [error, setError] = useState(initialError);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== "pending") return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const poll = setInterval(async () => {
      const res = await fetch(`/api/sessions/${id}/status`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status: Status; error: string | null };
      if (data.status === "done") router.refresh();
      setStatus(data.status);
      setError(data.error);
    }, 3000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [status, id, router]);

  async function retry() {
    setStatus("pending");
    setSeconds(0);
    setError(null);
    const res = await fetch(`/api/sessions/${id}/end`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.state === "done") router.refresh();
    if (data.state === "nothing") setStatus("error");
  }

  if (status === "pending") {
    return (
      <section className="card hero">
        <div className="status">
          <span className="dot speaking" />
          <span>Carla prépare ton bilan…</span>
          <span className="timer">{seconds}s</span>
        </div>
        <p className="muted small">
          Ça prend en général 10 à 30 secondes. Tu peux quitter cette page : le bilan sera dans « Mes bilans ».
        </p>
      </section>
    );
  }
  return (
    <section className="card fix">
      <p>
        {status === "stale"
          ? "La préparation du bilan a été interrompue."
          : status === "none"
            ? "Le bilan de cette séance n'a pas encore été créé."
            : "Le bilan n'a pas pu être créé."}{" "}
        Ta conversation est bien enregistrée.
      </p>
      {error && <p className="muted small">{error}</p>}
      {hasTranscript && (
        <button className="primary" onClick={retry}>
          Créer le bilan
        </button>
      )}
    </section>
  );
}
