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
