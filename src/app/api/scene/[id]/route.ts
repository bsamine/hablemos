import fs from "node:fs";
import path from "node:path";
import { isAuthed } from "@/lib/auth";
import { DATA_DIR } from "@/lib/db";
import { generateImage } from "@/lib/gemini";
import { SCENES } from "@/lib/modes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const g = globalThis as unknown as { __sceneJobs?: Map<string, Promise<Buffer>> };
const jobs = (g.__sceneJobs ??= new Map());

/** Scene illustration: generated once with the image model, then served from disk. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const scene = SCENES.find((s) => s.id === id);
  if (!scene) return new Response("not found", { status: 404 });
  const dir = path.join(DATA_DIR, "images");
  const file = path.join(dir, `scene-${scene.id}.png`);
  try {
    if (!fs.existsSync(file)) {
      if (!jobs.has(scene.id)) {
        jobs.set(
          scene.id,
          generateImage(
            `Warm, friendly editorial illustration for a Spanish lesson, flat colors, no text, no letters, no logos. ${scene.prompt}.`,
          ).finally(() => jobs.delete(scene.id)),
        );
      }
      const png = await jobs.get(scene.id)!;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, png);
    }
    return new Response(new Uint8Array(fs.readFileSync(file)), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=604800" },
    });
  } catch (e) {
    console.error("scene image failed:", e);
    return new Response("image indisponible", { status: 502 });
  }
}
