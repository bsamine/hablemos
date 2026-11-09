import { isAuthed } from "@/lib/auth";
import { addEvent, deleteEvent } from "@/lib/events";
import { go } from "@/lib/redirect";

export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  if (f.get("delete")) {
    deleteEvent(Number(f.get("delete")));
    return go("/vie-reelle#moments");
  }
  const title = String(f.get("title") ?? "").trim();
  const date = String(f.get("date") ?? "");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return go("/vie-reelle?e=moment#moments");
  const job = Number(f.get("job_ad_id") ?? 0);
  const id = addEvent({ title, date, kind: String(f.get("kind") ?? "other"), details: String(f.get("details") ?? ""), jobAdId: job || null });
  return go(`/moment/${id}`);
}
