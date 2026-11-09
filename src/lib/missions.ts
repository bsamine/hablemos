import { db } from "./db";

export type Mission = {
  id: number;
  session_id: number | null;
  text: string;
  phrase: string;
  status: "pending" | "done" | "skipped";
  note: string;
  created_at: string;
  done_at: string | null;
};

const EXPIRE_DAYS = 10;

/** A new mission replaces the previous pending one (only one at a time keeps it doable). */
export function addMission(text: string, phrase: string, sessionId: number | null) {
  const t = text?.trim();
  if (!t) return;
  db().prepare("UPDATE missions SET status = 'skipped' WHERE status = 'pending'").run();
  db()
    .prepare("INSERT INTO missions (session_id, text, phrase, created_at) VALUES (?, ?, ?, ?)")
    .run(sessionId, t.slice(0, 300), (phrase ?? "").trim().slice(0, 200), new Date().toISOString());
}

export function currentMission(): Mission | undefined {
  const m = db()
    .prepare("SELECT * FROM missions WHERE status = 'pending' ORDER BY id DESC LIMIT 1")
    .get() as Mission | undefined;
  if (m && Date.now() - Date.parse(m.created_at) > EXPIRE_DAYS * 86400_000) {
    db().prepare("UPDATE missions SET status = 'skipped' WHERE id = ?").run(m.id);
    return undefined;
  }
  return m;
}

export function listMissions(limit = 30): Mission[] {
  return db().prepare("SELECT * FROM missions ORDER BY id DESC LIMIT ?").all(limit) as Mission[];
}

export function setMission(id: number, status: "done" | "skipped", note = "") {
  db()
    .prepare("UPDATE missions SET status = ?, note = ?, done_at = ? WHERE id = ?")
    .run(status, note.trim().slice(0, 500), new Date().toISOString(), id);
}

/** What Carla should ask about: the pending mission and missions done since the last session. */
export function missionContext(): { pending?: Mission; recentDone: Mission[] } {
  const lastSession = db()
    .prepare("SELECT MAX(started_at) AS t FROM sessions WHERE transcript IS NOT NULL")
    .get() as { t: string | null };
  const recentDone = db()
    .prepare("SELECT * FROM missions WHERE status = 'done' AND done_at >= ? ORDER BY done_at DESC LIMIT 3")
    .all(lastSession.t ?? "1970-01-01") as Mission[];
  return { pending: currentMission(), recentDone };
}

export function missionStats() {
  return db().prepare("SELECT COUNT(*) AS done FROM missions WHERE status = 'done'").get() as { done: number };
}
