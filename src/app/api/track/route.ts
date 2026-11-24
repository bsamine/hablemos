import { track } from "@/lib/activity";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Page views from the browser (sendBeacon). Only app paths, nothing else. */
export async function POST(req: Request) {
  if (!(await isAuthed())) return new Response(null, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { path?: unknown };
  const path = typeof body.path === "string" ? body.path : "";
  if (/^\/[a-z0-9\-/[\]]*$/i.test(path) && path.length <= 120 && !path.startsWith("/api") && path !== "/login")
    track("page", path.replace(/\/\d+(?=\/|$)/g, "/:id"));
  return new Response(null, { status: 204 });
}
