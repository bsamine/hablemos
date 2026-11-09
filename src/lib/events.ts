import { db } from "./db";

export type EventKind = "interview" | "work" | "social" | "admin" | "travel" | "other";
export const EVENT_KINDS: { id: EventKind; label: string; icon: string }[] = [
  { id: "interview", label: "Entretien", icon: "💼" },
  { id: "work", label: "Travail", icon: "💊" },
  { id: "social", label: "Amis, sortie", icon: "🥘" },
  { id: "admin", label: "Démarche, rendez-vous", icon: "📋" },
  { id: "travel", label: "Voyage", icon: "🚆" },
  { id: "other", label: "Autre", icon: "✨" },
];

export type Pocket = { phrases: { es: string; fr: string }[]; tip_fr: string; opener_es: string };

export type LifeEvent = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  kind: EventKind;
  details: string;
  job_ad_id: number | null;
  pocket: string | null;
  status: "upcoming" | "done";
  created_at: string;
};

export function addEvent(e: { title: string; date: string; kind: string; details: string; jobAdId?: number | null }): number {
  const kind = EVENT_KINDS.some((k) => k.id === e.kind) ? e.kind : "other";
  const info = db()
    .prepare("INSERT INTO events (title, date, kind, details, job_ad_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(e.title.trim().slice(0, 120), e.date.slice(0, 10), kind, e.details.trim().slice(0, 1000), e.jobAdId ?? null, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function getEvent(id: number): LifeEvent | undefined {
  return db().prepare("SELECT * FROM events WHERE id = ?").get(id) as LifeEvent | undefined;
}

export function listEvents(): { upcoming: LifeEvent[]; past: LifeEvent[] } {
  const all = db().prepare("SELECT * FROM events ORDER BY date ASC").all() as LifeEvent[];
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  return {
    upcoming: all.filter((e) => e.date >= today && e.status !== "done"),
    past: all.filter((e) => e.date < today || e.status === "done").reverse(),
  };
}

export function deleteEvent(id: number) {
  db().prepare("DELETE FROM events WHERE id = ?").run(id);
}

export function setPocket(id: number, pocket: Pocket) {
  db().prepare("UPDATE events SET pocket = ? WHERE id = ?").run(JSON.stringify(pocket), id);
}

export function daysUntil(date: string): number {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  return Math.round((Date.parse(date) - Date.parse(today)) / 86400_000);
}
