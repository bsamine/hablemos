import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { history } from "@/lib/history";
import { asLength, LENGTH_MINUTES } from "@/lib/modes";
import { getScenario } from "@/lib/scenarios";
import HistoryList from "../../HistoryList";
import Conversation from "../../Conversation";
import LengthPicker from "../../LengthPicker";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<{ duree?: string }>;
}) {
  await requireAuth();
  const { scenarioId } = await params;
  const length = asLength((await searchParams).duree);
  const scenario = getScenario(scenarioId);
  if (!scenario) notFound();
  const past = history({ scenarioId: scenario.id, limit: 10 });
  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="chip">{scenario.theme} · {scenario.level}</span>
      </header>
      <div>
        <p className="eyebrow">Leçon</p>
        <h1>{scenario.title}</h1>
        <p className="muted">{scenario.titleFr}</p>
      </div>
      <LengthPicker base={`/session/${scenario.id}`} value={length} />
      <Conversation
        key={length}
        preview={{
          title: scenario.title,
          taskGoal: scenario.taskGoal,
          words: scenario.words,
          wordsLabel: "Les 5 mots du jour",
          minutes: LENGTH_MINUTES[length],
        }}
        start={{ mode: "scenario", scenarioId: scenario.id, length }}
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
