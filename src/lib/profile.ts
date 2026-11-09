import { db } from "./db";
import type { Feedback } from "./prompts";

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

function get(key: string): string | undefined {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return r?.value;
}
function set(key: string, value: string) {
  db()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export type Profile = { name: string; about: string; level: Level };

export function getProfile(): Profile {
  const level = (get("level") ?? process.env.LEARNER_LEVEL ?? "A1") as Level;
  return { name: get("name") ?? "", about: get("about") ?? "", level: LEVELS.includes(level) ? level : "A1" };
}

export function saveProfile(p: Partial<Profile>) {
  if (p.name !== undefined) set("name", p.name.trim().slice(0, 60));
  if (p.about !== undefined) set("about", p.about.trim().slice(0, 2000));
  if (p.level && LEVELS.includes(p.level)) {
    set("level", p.level);
    set("level_dismissed", "");
  }
}

// ---------- What Carla remembers about her ----------

export type Fact = { id: number; text: string; created_at: string };
const MAX_FACTS = 60;

export function listFacts(): Fact[] {
  return db().prepare("SELECT id, text, created_at FROM facts ORDER BY id DESC").all() as Fact[];
}

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

export function addFacts(texts: string[], sessionId: number | null = null) {
  const known = new Set(listFacts().map((f) => norm(f.text)));
  const ins = db().prepare("INSERT INTO facts (text, session_id, created_at) VALUES (?, ?, ?)");
  for (const raw of texts) {
    const t = raw?.trim();
    if (!t || t.length > 200 || known.has(norm(t))) continue;
    known.add(norm(t));
    ins.run(t, sessionId, new Date().toISOString());
  }
  // keep the newest facts only
  db().prepare("DELETE FROM facts WHERE id NOT IN (SELECT id FROM facts ORDER BY id DESC LIMIT ?)").run(MAX_FACTS);
}

export function deleteFact(id: number) {
  db().prepare("DELETE FROM facts WHERE id = ?").run(id);
}

/** Short notes of what happened in the last sessions, for continuity. */
export function recentNotes(limit = 3): { date: string; title: string; note: string }[] {
  const rows = db()
    .prepare("SELECT started_at, spec, scenario_id, feedback FROM sessions WHERE feedback IS NOT NULL ORDER BY started_at DESC LIMIT ?")
    .all(limit) as { started_at: string; spec: string | null; scenario_id: string; feedback: string }[];
  return rows.map((r) => {
    const fb = JSON.parse(r.feedback) as Feedback;
    const title = r.spec ? (JSON.parse(r.spec) as { title: string }).title : r.scenario_id;
    return { date: r.started_at.slice(0, 10), title, note: fb.memory_note || fb.summary_fr || "" };
  });
}

// ---------- Level suggestion ----------

/** Suggest the next level when most recent sessions were judged above the current one. */
export function levelSuggestion(): Level | null {
  const { level } = getProfile();
  const idx = LEVELS.indexOf(level);
  if (idx >= LEVELS.length - 1 || get("level_dismissed") === level) return null;
  const rows = db()
    .prepare("SELECT feedback FROM sessions WHERE feedback IS NOT NULL ORDER BY started_at DESC LIMIT 5")
    .all() as { feedback: string }[];
  if (rows.length < 4) return null;
  const above = rows.filter((r) => {
    const s = (JSON.parse(r.feedback) as Feedback).level_signals;
    return s && s.confidence !== "low" && LEVELS.indexOf(s.estimated_cefr as Level) > idx;
  }).length;
  return above >= 3 ? LEVELS[idx + 1] : null;
}

export function dismissLevelSuggestion() {
  set("level_dismissed", getProfile().level);
}
