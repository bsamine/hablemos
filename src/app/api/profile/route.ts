import { isAuthed } from "@/lib/auth";
import { saveProfile, type Level, type Profile } from "@/lib/profile";
import { go } from "@/lib/redirect";

/** Saves only the fields present in the form (several small forms share this route). */
export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  const p: Partial<Profile> = {};
  if (f.has("name")) p.name = String(f.get("name"));
  if (f.has("about")) p.about = String(f.get("about"));
  if (f.has("level")) p.level = String(f.get("level")) as Level;
  if (f.has("partner")) p.partner = String(f.get("partner"));
  saveProfile(p);
  const next = String(f.get("next") ?? "");
  return go(next.startsWith("/") ? next : "/profil?ok=1");
}
