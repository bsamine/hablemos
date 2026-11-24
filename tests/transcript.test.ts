import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTurns, longerTranscript } from "../src/lib/transcript";

test("cleanTurns keeps only well-formed, non-empty turns", () => {
  const out = cleanTurns([
    { role: "learner", text: "Hola" },
    { role: "tutor", text: "  " },
    { role: "hacker", text: "x" },
    null,
    { role: "tutor", text: 42 },
    { role: "tutor", text: "¿Qué tal?", extra: "dropped" },
  ]);
  assert.deepEqual(out, [
    { role: "learner", text: "Hola" },
    { role: "tutor", text: "¿Qué tal?" },
  ]);
  assert.equal(cleanTurns("nope"), null);
  assert.equal(cleanTurns(undefined), null);
});

test("a shorter transcript never replaces a longer saved one", () => {
  const saved = JSON.stringify([
    { role: "learner", text: "a" },
    { role: "tutor", text: "b" },
  ]);
  assert.equal(longerTranscript(saved, [{ role: "learner", text: "a" }]).length, 2);
  assert.equal(longerTranscript(saved, [...JSON.parse(saved), { role: "learner", text: "c" }]).length, 3);
  assert.equal(longerTranscript(null, []).length, 0);
});
