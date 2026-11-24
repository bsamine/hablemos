import assert from "node:assert/strict";
import { test } from "node:test";
import { labEnabled, modeAllowed } from "../src/lib/features";

test("only the core loop is available when the lab is off", () => {
  delete process.env.FEATURES_LAB;
  assert.equal(labEnabled(), false);
  for (const m of ["scenario", "redo", "review"] as const) assert.equal(modeAllowed(m), true, m);
  for (const m of ["interview", "duo", "story", "picture", "dele", "custom", "shadowing", "prep", "checkup"] as const)
    assert.equal(modeAllowed(m), false, m);
});

test("everything is available with FEATURES_LAB=1", () => {
  process.env.FEATURES_LAB = "1";
  assert.equal(modeAllowed("interview"), true);
  delete process.env.FEATURES_LAB;
});
