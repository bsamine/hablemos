import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../src/lib/db";
import { buildSpec, LENGTH_MINUTES, randomSpec, scenarioSpec } from "../src/lib/modes";
import { buildTutorPrompt } from "../src/lib/prompts";
import { getScenario } from "../src/lib/scenarios";
import { pickSituation, SITUATIONS, situationsFor } from "../src/lib/situations";
import { costOf, recordLiveUsage, recordUsage, sanitizeTokens, tokensOf, usageSummary } from "../src/lib/usage";

test("lessons come in two formats: quick 10 min and long 30 min", () => {
  const s = getScenario("presentarse")!;
  const quick = scenarioSpec(s, "quick");
  const long = scenarioSpec(s, "long");
  assert.equal(quick.minutes, 10);
  assert.equal(long.minutes, 30);
  assert.match(quick.plan, /RAPIDE/);
  assert.match(long.plan, /LONGUE/);
  assert.equal(buildSpec({ mode: "scenario", scenarioId: "presentarse" })!.minutes, LENGTH_MINUTES.quick, "default is quick");
  assert.equal(buildSpec({ mode: "scenario", scenarioId: "presentarse", length: "long" })!.length, "long");
});

test("random conversations: catalogue, level filter, no immediate repeat", () => {
  assert.ok(SITUATIONS.length >= 20);
  assert.equal(new Set(SITUATIONS.map((s) => s.id)).size, SITUATIONS.length, "unique ids");
  for (const id of ["restaurante", "peluqueria", "mudanza", "cena-amigos"]) assert.ok(SITUATIONS.some((s) => s.id === id), id);
  assert.ok(situationsFor("A1").every((s) => s.level !== "B1"), "A1 never gets B1 situations");
  const recent = situationsFor("A1").slice(1).map((s) => s.id);
  assert.equal(pickSituation("A1", recent).id, situationsFor("A1")[0].id, "avoids recently done ones");
  const spec = buildSpec({ mode: "random", situationId: "peluqueria", length: "long" })!;
  assert.equal(spec.mode, "random");
  assert.equal(spec.minutes, 30);
  assert.equal(buildSpec({ mode: "random", situationId: "nope" }), null);
  assert.ok(randomSpec(SITUATIONS[0]).plan.length > 100);
});

const learner = { name: "Lucie", about: "Pharmacienne à Lyon", facts: ["Elle a un chat"], notes: [] };
const prompt = (name = "Lucie") =>
  buildTutorPrompt({
    spec: scenarioSpec(getScenario("presentarse")!, "quick"),
    level: "A1",
    reviewWords: [],
    knownErrors: [],
    learner: { ...learner, name },
    now: new Date("2026-11-24T10:00:00Z"),
  });

test("Carla's prompt keeps her name and profile, and keeps instructions private", () => {
  const p = prompt();
  assert.ok((p.match(/Lucie/g) ?? []).length >= 4, "name appears at the start, in the rules and in the final reminder");
  assert.match(p, /Pharmacienne à Lyon/);
  assert.match(p, /Elle a un chat/);
  assert.match(p, /RÈGLE ABSOLUE N°1/);
  assert.match(p, /\[INICIO\]/);
  assert.match(p, /\[RECONEXIÓN\]/);
  assert.match(p, /accent français natif/);
  assert.match(p, /accent castillan/);
  assert.match(p, /environ 10 minutes/);
  // The private rules come before the session content.
  assert.ok(p.indexOf("RÈGLE ABSOLUE") < p.indexOf("DÉROULÉ"));
  assert.match(prompt(""), /demande-le au tout début/);
});

test("the live screen no longer sends French instructions as if she had spoken", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("src/app/Conversation.tsx", "utf8");
  assert.doesNotMatch(src, /Salue-la|Reprends naturellement|La séance commence/);
  assert.match(src, /\[INICIO\]/);
  assert.match(src, /\[TIEMPO\]/);
});

test("token usage: normalisation, cost, live rows only grow", () => {
  const t = tokensOf({
    promptTokenCount: 1000,
    responseTokenCount: 500,
    promptTokensDetails: [{ modality: "AUDIO", tokenCount: 800 }, { modality: "TEXT", tokenCount: 200 }],
    responseTokensDetails: [{ modality: "AUDIO", tokenCount: 500 }],
  });
  assert.deepEqual(t, { input: 1000, output: 500, inputAudio: 800, outputAudio: 500 });
  assert.ok(costOf("live", t) > costOf("generate", t), "live audio costs more than text");
  assert.equal(sanitizeTokens({ input: -5, output: "x", inputAudio: 99 })!.inputAudio, 0, "audio never above input");

  db().prepare("INSERT INTO sessions (id, scenario_id, started_at) VALUES (500, 'x', ?)").run(new Date().toISOString());
  recordLiveUsage(500, "live-model", { input: 1000, output: 200 });
  recordLiveUsage(500, "live-model", { input: 400, output: 100 }); // stale beacon arriving late
  recordLiveUsage(500, "live-model", { input: 3000, output: 900 });
  const rows = db().prepare("SELECT * FROM usage WHERE session_id = 500").all() as { input_tokens: number; output_tokens: number }[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].input_tokens, 3000);
  assert.equal(rows[0].output_tokens, 900);

  recordUsage("debrief", "text-model", { promptTokenCount: 2000, candidatesTokenCount: 800, thoughtsTokenCount: 200 }, 500);
  recordUsage("tts", "tts-model", undefined); // nothing to record
  const u = usageSummary();
  assert.equal(u.today.tokens, 3000 + 900 + 2000 + 1000);
  assert.ok(u.month.costEur > 0);
  assert.deepEqual(u.byKind.map((k) => k.kind).sort(), ["debrief", "live"]);
});
