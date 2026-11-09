import { isAuthed } from "@/lib/auth";
import { addJobAd, deleteJobAd } from "@/lib/jobs";
import { go } from "@/lib/redirect";

export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  if (f.get("delete")) {
    deleteJobAd(Number(f.get("delete")));
    return go("/entretiens");
  }
  const text = String(f.get("text") ?? "").trim();
  if (text.length < 40) return go("/entretiens?e=court#offre");
  const id = addJobAd(String(f.get("title") ?? ""), String(f.get("company") ?? ""), text);
  return go(`/entretiens/offre/${id}`);
}
