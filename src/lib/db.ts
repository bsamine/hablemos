import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

type Db = Database.Database;
const g = globalThis as unknown as { __hablemosDb?: Db };

export function db(): Db {
  if (g.__hablemosDb) return g.__hablemosDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const conn = new Database(path.join(DATA_DIR, "hablemos.db"));
  conn.pragma("journal_mode = WAL");
  conn.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_s INTEGER,
      target_words TEXT NOT NULL DEFAULT '[]',
      review_words TEXT NOT NULL DEFAULT '[]',
      transcript TEXT,
      feedback TEXT
    );
    CREATE TABLE IF NOT EXISTS words (
      word TEXT PRIMARY KEY,
      translation TEXT NOT NULL DEFAULT '',
      example TEXT NOT NULL DEFAULT '',
      stage INTEGER NOT NULL DEFAULT 0,
      due_at TEXT NOT NULL,
      times_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      learner_said TEXT NOT NULL,
      correction TEXT NOT NULL,
      rule_fr TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  conn.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS job_ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      text TEXT NOT NULL,
      phrase TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      done_at TEXT
    );
    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      session_id INTEGER,
      created_at TEXT NOT NULL
    );
  `);
  for (const col of [
    "debrief_status TEXT",
    "debrief_error TEXT",
    "debrief_started_at TEXT",
    "mode TEXT",
    "spec TEXT",
  ]) {
    try {
      conn.exec(`ALTER TABLE sessions ADD COLUMN ${col}`);
    } catch {
      /* column already exists */
    }
  }
  g.__hablemosDb = conn;
  return conn;
}

export type SessionRow = {
  id: number;
  scenario_id: string;
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  target_words: string;
  review_words: string;
  transcript: string | null;
  feedback: string | null;
  debrief_status: "pending" | "done" | "error" | null;
  debrief_error: string | null;
  debrief_started_at: string | null;
  mode: string | null;
  spec: string | null;
};

export type WordRow = {
  word: string;
  translation: string;
  example: string;
  stage: number;
  due_at: string;
  times_used: number;
  created_at: string;
};
