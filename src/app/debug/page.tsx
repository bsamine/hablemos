import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { LIVE_API_VERSION, LIVE_MODEL, VOICE } from "@/lib/gemini";
import Diagnostic from "./Diagnostic";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  await requireAuth();
  if (process.env.ENABLE_DEBUG !== "1") notFound();
  return <Diagnostic model={LIVE_MODEL} apiVersion={LIVE_API_VERSION} voice={VOICE} />;
}
