import { isAuthed } from "@/lib/auth";
import { addFacts, deleteFact } from "@/lib/profile";
import { go } from "@/lib/redirect";

export async function POST(req: Request) {
  if (!(await isAuthed())) return go("/login");
  const f = await req.formData().catch(() => new FormData());
  if (f.get("delete")) deleteFact(Number(f.get("delete")));
  const text = String(f.get("text") ?? "").trim();
  if (text) addFacts([text]);
  return go("/profil#memoire");
}
