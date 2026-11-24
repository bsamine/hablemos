import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../src/lib/db";
import { applyFeedback, MASTERED_STAGE } from "../src/lib/learning";
import type { Feedback } from "../src/lib/prompts";

const stage = (w: string) => (db().prepare("SELECT stage FROM words WHERE word = ?").get(w) as { stage: number }).stage;

test("words move up when used alone, down when not used", () => {
  applyFeedback(1, [{ word: "casa", fr: "maison", example: "Mi casa" }, { word: "perro", fr: "chien", example: "" }], {} as Feedback);
  assert.equal(stage("casa"), 0);
  for (let i = 0; i < 10; i++)
    applyFeedback(1, [], { words: [{ word: "casa", status: "used_alone" }] } as unknown as Feedback);
  assert.equal(stage("casa"), MASTERED_STAGE, "capped at mastered");
  applyFeedback(1, [], { words: [{ word: "perro", status: "not_used" }] } as unknown as Feedback);
  assert.equal(stage("perro"), 0, "never below 0");
});

test("a sloppy debrief from the model does not crash and does not invent data", () => {
  const fb = {
    words: [{ word: "", status: "used_alone" }, { word: "inconnu", status: "weird" }],
    new_words: [{ word: "gato" }, { translation_fr: "sans mot" }],
    errors: [{}, { category: "ser_estar", learner_said: "soy cansada", correction: "estoy cansada", rule_fr: "état → estar" }],
  } as unknown as Feedback;
  applyFeedback(7, [], fb);
  assert.ok(db().prepare("SELECT 1 FROM words WHERE word = 'gato'").get(), "new word with missing fields is kept");
  assert.equal(db().prepare("SELECT 1 FROM words WHERE word = 'inconnu'").get(), undefined, "unknown word is not created by a review");
  const errs = db().prepare("SELECT category FROM errors WHERE session_id = 7 ORDER BY id").all() as { category: string }[];
  assert.deepEqual(errs.map((e) => e.category), ["other", "ser_estar"]);
});
