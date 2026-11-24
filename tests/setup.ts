import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Each test file gets its own empty data folder. Import this first, before anything that touches the db. */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hablemos-test-"));
process.env.DATA_DIR = dir;
delete process.env.GEMINI_API_KEY; // tests never call Gemini
export const DATA_DIR = dir;
