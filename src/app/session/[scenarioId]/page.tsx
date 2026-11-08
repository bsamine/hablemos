import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getScenario } from "@/lib/scenarios";
import Conversation from "./Conversation";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  await requireAuth();
  const { scenarioId } = await params;
  const scenario = getScenario(scenarioId);
  if (!scenario) notFound();
  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">Jour {scenario.day} · {scenario.level}</span>
      </header>
      <div>
        <h1>{scenario.title}</h1>
        <p className="muted">{scenario.titleFr}</p>
      </div>
      <Conversation scenario={scenario} />
    </div>
  );
}
