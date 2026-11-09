import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { history } from "@/lib/history";
import { getScenario } from "@/lib/scenarios";
import HistoryList from "../../HistoryList";
import Conversation from "../../Conversation";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  await requireAuth();
  const { scenarioId } = await params;
  const scenario = getScenario(scenarioId);
  if (!scenario) notFound();
  const past = history({ scenarioId: scenario.id, limit: 10 });
  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">{scenario.theme} · {scenario.level}</span>
      </header>
      <div>
        <h1>{scenario.title}</h1>
        <p className="muted">{scenario.titleFr}</p>
      </div>
      <Conversation
        preview={{ title: scenario.title, taskGoal: scenario.taskGoal, words: scenario.words, wordsLabel: "Les 5 mots du jour" }}
        start={{ mode: "scenario", scenarioId: scenario.id }}
      />
      {past.length > 0 && (
        <section className="stack">
          <h3>Mes bilans sur ce thème</h3>
          <HistoryList items={past} showTitle={false} />
        </section>
      )}
    </div>
  );
}
