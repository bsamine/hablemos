import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

type Db = Database.Database;
const g = globalThis as unknown as { __hablemosDb?: Db };

export function db(): Db {
  if (g.__hablemosDb) return g.__hablemosDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const conn = new Database(path.join(DATA_DIR, "hablemos.db"));
  conn.pragma("journal_mode = WAL");
  conn.pragma("busy_timeout = 5000");
  migrate(conn);
  g.__hablemosDb = conn;
  return conn;
}

function hasColumn(c: Db, table: string, col: string): boolean {
  return (c.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((r) => r.name === col);
}

function addColumn(c: Db, table: string, def: string) {
  const name = def.split(" ")[0];
  if (!hasColumn(c, table, name)) c.exec(`ALTER TABLE ${table} ADD COLUMN ${def}`);
}

/**
 * Schema changes, applied once each in order and recorded in PRAGMA user_version.
 * Never edit a migration that has shipped: add a new one at the end.
 * Migration 1 is tolerant (IF NOT EXISTS, column checks) because databases created before
 * versioning already have part or all of it.
 */
export const MIGRATIONS: ((c: Db) => void)[] = [
  // 1 — baseline: the schema as of v0.1.2
  (c) => {
    c.exec(`
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
    c.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS voice_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL DEFAULT '',
      file TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'other',
      details TEXT NOT NULL DEFAULT '',
      job_ad_id INTEGER,
      pocket TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL
    );
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
    for (const col of ["debrief_status TEXT", "debrief_error TEXT", "debrief_started_at TEXT", "mode TEXT", "spec TEXT"])
      addColumn(c, "sessions", col);
    addColumn(c, "job_ads", "pack TEXT");
  },
  // 2 — v0.2.0: transcript saved during the session, error log
  (c) => {
    addColumn(c, "sessions", "last_seen_at TEXT");
    c.exec(`
      CREATE TABLE IF NOT EXISTS error_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS error_log_at ON error_log(at);
    `);
  },
  // 3 — v0.3.0: Gemini usage (tokens) and activity tracking
  (c) => {
    c.exec(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        kind TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        session_id INTEGER,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        input_audio_tokens INTEGER NOT NULL DEFAULT 0,
        output_audio_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS usage_at ON usage(at);
      CREATE UNIQUE INDEX IF NOT EXISTS usage_live_session ON usage(session_id) WHERE kind = 'live';
      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        kind TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS activity_at ON activity(at);
    `);
    addColumn(c, "sessions", "length TEXT");
  },
];

export function migrate(c: Db): number {
  const current = c.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    c.transaction(() => {
      MIGRATIONS[v](c);
      c.pragma(`user_version = ${v + 1}`);
    })();
  }
  return MIGRATIONS.length;
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
  last_seen_at: string | null;
  length: string | null;
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
