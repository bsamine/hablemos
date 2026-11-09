import { isAuthed } from "@/lib/auth";
import { setMission } from "@/lib/missions";
import { go } from "@/lib/redirect";

export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  const id = Number(f.get("id"));
  const status = f.get("status") === "skipped" ? "skipped" : "done";
  if (id) setMission(id, status, String(f.get("note") ?? ""));
  const next = String(f.get("next") ?? "/vie-reelle");
  return go(next.startsWith("/") ? next : "/vie-reelle");
}
