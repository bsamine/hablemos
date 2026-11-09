import type { Mission } from "@/lib/missions";
import { Say } from "./feedback/[id]/client";

/** The current real-life mission, with "done" (and a note) or "skip". */
export default function MissionCard({ mission, next }: { mission: Mission; next: string }) {
  return (
    <section className="card mission">
      <p className="eyebrow">🎯 Ta mission dans la vraie vie</p>
      <p className="mission-text">{mission.text}</p>
      {mission.phrase && (
        <p className="better">
          <Say text={mission.phrase} /> {mission.phrase}
        </p>
      )}
      <form action="/api/missions" method="post" className="stack">
        <input type="hidden" name="id" value={mission.id} />
        <input type="hidden" name="next" value={next} />
        <input name="note" maxLength={500} placeholder="Comment ça s'est passé ? (facultatif)" />
        <div className="row">
          <button className="primary" type="submit" name="status" value="done">C'est fait ✓</button>
          <button className="link small" type="submit" name="status" value="skipped">Passer cette mission</button>
        </div>
      </form>
      <p className="muted small">Carla te demandera comment ça s'est passé à la prochaine séance.</p>
    </section>
  );
}
