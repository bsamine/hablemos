import { isAuthed } from "@/lib/auth";
import { saveProfile, type Level } from "@/lib/profile";
import { go } from "@/lib/redirect";

export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  saveProfile({
    name: String(f.get("name") ?? ""),
    about: String(f.get("about") ?? ""),
    level: String(f.get("level") ?? "") as Level,
  });
  return go(String(f.get("next") ?? "/profil?ok=1"));
}
