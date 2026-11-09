import { db } from "./db";

export type JobAd = { id: number; title: string; company: string; text: string; created_at: string };

export function addJobAd(title: string, company: string, text: string): number {
  const info = db()
    .prepare("INSERT INTO job_ads (title, company, text, created_at) VALUES (?, ?, ?, ?)")
    .run(title.trim().slice(0, 120) || "Offre sans titre", company.trim().slice(0, 120), text.trim().slice(0, 6000), new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function getJobAd(id: number): JobAd | undefined {
  return db().prepare("SELECT * FROM job_ads WHERE id = ?").get(id) as JobAd | undefined;
}

export function listJobAds(): JobAd[] {
  return db().prepare("SELECT * FROM job_ads ORDER BY id DESC").all() as JobAd[];
}

export function deleteJobAd(id: number) {
  db().prepare("DELETE FROM job_ads WHERE id = ?").run(id);
}
