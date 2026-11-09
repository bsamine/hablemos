import { isAuthed } from "@/lib/auth";
import { dismissLevelSuggestion, saveProfile, type Level } from "@/lib/profile";
import { go } from "@/lib/redirect";

export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  const level = String(f.get("level") ?? "");
  if (level) saveProfile({ level: level as Level });
  else dismissLevelSuggestion();
  return go("/");
}
