import { requireAuth } from "@/lib/auth";
import { LIVE_API_VERSION, LIVE_MODEL, VOICE } from "@/lib/gemini";
import Diagnostic from "./Diagnostic";

export const dynamic = "force-dynamic";

export default async function DebugPage() {
  await requireAuth();
  return <Diagnostic model={LIVE_MODEL} apiVersion={LIVE_API_VERSION} voice={VOICE} />;
}
