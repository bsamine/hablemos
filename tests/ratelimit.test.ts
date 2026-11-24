import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlocked, MAX_FAILURES, recordFailure, recordSuccess, WINDOW_MS } from "../src/lib/ratelimit";

test("an address is blocked after too many wrong codes, then released", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure("1.2.3.4", t0);
  assert.equal(isBlocked("1.2.3.4", t0), false);
  recordFailure("1.2.3.4", t0);
  assert.equal(isBlocked("1.2.3.4", t0 + 1000), true);
  assert.equal(isBlocked("5.6.7.8", t0), false, "other addresses are not affected");
  assert.equal(isBlocked("1.2.3.4", t0 + WINDOW_MS + 1), false, "released after the window");
});

test("a correct code clears the counter", () => {
  recordFailure("9.9.9.9");
  recordFailure("9.9.9.9");
  recordSuccess("9.9.9.9");
  for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure("9.9.9.9");
  assert.equal(isBlocked("9.9.9.9"), false);
});
