import "./setup";
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { DATA_DIR } from "./setup";
import { db, migrate, MIGRATIONS } from "../src/lib/db";

const cols = (c: Database.Database, t: string) => (c.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((r) => r.name);

test("a new database gets every migration", () => {
  const c = db();
  assert.equal(c.pragma("user_version", { simple: true }), MIGRATIONS.length);
  assert.ok(cols(c, "sessions").includes("last_seen_at"));
  assert.ok(cols(c, "error_log").includes("message"));
});

test("a v0.1.2 database (no user_version, old columns) is upgraded without losing data", () => {
  const c = new Database(path.join(DATA_DIR, "legacy.db"));
  c.exec(`CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, scenario_id TEXT NOT NULL, started_at TEXT NOT NULL,
            ended_at TEXT, duration_s INTEGER, target_words TEXT NOT NULL DEFAULT '[]', review_words TEXT NOT NULL DEFAULT '[]',
            transcript TEXT, feedback TEXT, debrief_status TEXT, mode TEXT);
          CREATE TABLE job_ads (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, company TEXT NOT NULL DEFAULT '',
            text TEXT NOT NULL, created_at TEXT NOT NULL, pack TEXT);
          INSERT INTO sessions (scenario_id, started_at, feedback) VALUES ('s1', '2026-11-01T10:00:00Z', '{}');`);
  migrate(c);
  assert.equal(c.pragma("user_version", { simple: true }), MIGRATIONS.length);
  assert.ok(cols(c, "sessions").includes("spec"));
  assert.ok(cols(c, "sessions").includes("last_seen_at"));
  assert.equal((c.prepare("SELECT COUNT(*) n FROM sessions").get() as { n: number }).n, 1);
  // Running again is a no-op.
  migrate(c);
  assert.equal(c.pragma("user_version", { simple: true }), MIGRATIONS.length);
  c.close();
});
