import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, db } from "./db";
import { generateJson } from "./gemini";

export type VoiceKind = "missing" | "debrief" | "diary" | "pronunciation";

export type VoiceNote = {
  id: number;
  kind: VoiceKind;
  ref: string;
  file: string | null;
  status: "pending" | "done" | "error";
  result: string | null;
  error: string | null;
  created_at: string;
};

export const RETENTION_DAYS = 60;
const AUDIO_DIR = path.join(DATA_DIR, "audio");

export function getVoiceNote(id: number): VoiceNote | undefined {
  return db().prepare("SELECT * FROM voice_notes WHERE id = ?").get(id) as VoiceNote | undefined;
}

export function listVoiceNotes(kind: VoiceKind, limit = 30, ref?: string): VoiceNote[] {
  return (
    ref
      ? db().prepare("SELECT * FROM voice_notes WHERE kind = ? AND ref = ? ORDER BY id DESC LIMIT ?").all(kind, ref, limit)
      : db().prepare("SELECT * FROM voice_notes WHERE kind = ? ORDER BY id DESC LIMIT ?").all(kind, limit)
  ) as VoiceNote[];
}

/** Store the recording, then analyse it in the background. */
export function saveVoiceNote(kind: VoiceKind, ref: string, wav: Buffer): number {
  cleanupOldAudio();
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const info = db()
    .prepare("INSERT INTO voice_notes (kind, ref, created_at) VALUES (?, ?, ?)")
    .run(kind, ref, new Date().toISOString());
  const id = Number(info.lastInsertRowid);
  const file = `note-${id}.wav`;
  fs.writeFileSync(path.join(AUDIO_DIR, file), wav);
  db().prepare("UPDATE voice_notes SET file = ? WHERE id = ?").run(file, id);
  void process(id);
  return id;
}

export function retryVoiceNote(id: number) {
  db().prepare("UPDATE voice_notes SET status = 'pending', error = NULL WHERE id = ?").run(id);
  void process(id);
}

async function process(id: number) {
  const note = getVoiceNote(id);
  if (!note?.file) return;
  try {
    const { analyseNote } = await import("./voice-handlers");
    const p = path.join(AUDIO_DIR, note.file);
    if (!fs.existsSync(p)) throw new Error("enregistrement expiré");
    const result = await analyseNote(note, { data: fs.readFileSync(p).toString("base64"), mimeType: "audio/wav" });
    db().prepare("UPDATE voice_notes SET status = 'done', result = ?, error = NULL WHERE id = ?").run(JSON.stringify(result), id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`voice note ${id} failed:`, msg);
    db().prepare("UPDATE voice_notes SET status = 'error', error = ? WHERE id = ?").run(msg, id);
  }
}

/** Recordings are kept 60 days; transcripts and results stay. */
function cleanupOldAudio() {
  const limit = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  const old = db()
    .prepare("SELECT id, file FROM voice_notes WHERE file IS NOT NULL AND created_at < ?")
    .all(limit) as { id: number; file: string }[];
  for (const o of old) {
    try {
      fs.unlinkSync(path.join(AUDIO_DIR, o.file));
    } catch {
      /* already gone */
    }
    db().prepare("UPDATE voice_notes SET file = NULL WHERE id = ?").run(o.id);
  }
}

/** Shared helper: ask the model about a recording and get JSON back. */
export function analyseAudio(prompt: string, audio: { data: string; mimeType: string }) {
  return generateJson(prompt, audio);
}
