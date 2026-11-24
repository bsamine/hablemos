import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../src/lib/db";
import { ABANDON_AFTER_MS, sweep } from "../src/lib/sweeper";

const spec = JSON.stringify({ mode: "scenario", scenarioId: "x", title: "T", taskGoal: "G", words: [], minutes: 15 });
function add(lastSeenMinAgo: number, transcript: { role: string; text: string }[] | null) {
  const at = new Date(Date.now() - lastSeenMinAgo * 60_000).toISOString();
  const r = db()
    .prepare("INSERT INTO sessions (scenario_id, started_at, last_seen_at, transcript, mode, spec) VALUES ('x', ?, ?, ?, 'scenario', ?)")
    .run(at, at, transcript ? JSON.stringify(transcript) : null, spec);
  return Number(r.lastInsertRowid);
}
const row = (id: number) => db().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, string | null>;

test("abandoned sessions are closed and debriefed; live ones are left alone", async () => {
  const minutes = ABANDON_AFTER_MS / 60_000;
  const abandoned = add(minutes + 10, [{ role: "learner", text: "Me llamo Ana" }, { role: "tutor", text: "¡Hola Ana!" }]);
  const silent = add(minutes + 10, [{ role: "tutor", text: "¡Hola!" }]);
  const live = add(2, [{ role: "learner", text: "Hola" }]);

  const { closed } = sweep();
  assert.deepEqual(closed, [abandoned]);
  assert.ok(row(abandoned).ended_at, "abandoned session is closed");
  assert.ok(row(silent).ended_at, "a session where she never spoke is closed too");
  assert.equal(row(silent).debrief_status, null, "…but not debriefed");
  assert.equal(row(live).ended_at, null, "a live session is untouched");

  // No API key in tests: the debrief fails, and the failure is recorded for the alert.
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(row(abandoned).debrief_status, "error");
  const logged = db().prepare("SELECT * FROM error_log WHERE source = 'debrief'").all();
  assert.equal(logged.length, 1);

  // A second sweep does nothing more.
  assert.deepEqual(sweep().closed, []);
});
