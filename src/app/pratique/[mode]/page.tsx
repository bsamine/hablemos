import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { customSpec, redoSpec, reviewSpec, type SessionSpec, type StartRequest } from "@/lib/modes";
import Conversation from "../../Conversation";

export const dynamic = "force-dynamic";

const IDEAS = [
  "Je prends rendez-vous chez le médecin par téléphone",
  "Je rencontre de nouveaux amis dans un bar à Madrid",
  "Je me présente lors d'un entretien pour un poste en laboratoire",
  "J'explique à une collègue comment utiliser un médicament",
  "Je réserve une table au restaurant pour samedi soir",
];

export default async function Pratique({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ from?: string; sujet?: string }>;
}) {
  await requireAuth();
  const { mode } = await params;
  const q = await searchParams;

  let spec: SessionSpec | null = null;
  let start: StartRequest | null = null;
  let empty = "";
  if (mode === "refaire") {
    spec = redoSpec(Number(q.from));
    start = { mode: "redo", fromSessionId: Number(q.from) };
    empty = "Il n'y a pas de correction à refaire pour cette séance.";
  } else if (mode === "revision") {
    spec = reviewSpec();
    start = { mode: "review" };
    empty = "Aucun mot à réviser aujourd'hui. Reviens demain, ou fais une nouvelle séance !";
  } else if (mode === "theme") {
    if (!q.sujet) return <ThemeForm />;
    spec = customSpec(q.sujet);
    start = { mode: "custom", topic: q.sujet };
    empty = "Décris la situation en quelques mots.";
  } else notFound();

  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        {spec && <span className="muted small">≈ {spec.minutes} min</span>}
      </header>
      {spec && start ? (
        <>
          <div>
            <h1>{spec.title}</h1>
            <p className="muted">{spec.titleFr}</p>
          </div>
          <Conversation
            preview={{
              title: spec.title,
              taskGoal: spec.taskGoal,
              words: spec.words,
              wordsLabel: mode === "revision" ? "Les mots à retrouver (cache-les si tu veux jouer !)" : undefined,
            }}
            start={start}
          />
        </>
      ) : (
        <p className="card">{empty}</p>
      )}
    </div>
  );
}

function ThemeForm() {
  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
      </header>
      <div>
        <h1>Mon thème</h1>
        <p className="muted">Décris une situation réelle que tu veux savoir gérer en espagnol. Carla prépare le vocabulaire et joue le rôle.</p>
      </div>
      <form className="stack" method="get">
        <textarea name="sujet" rows={3} maxLength={300} required placeholder="Ex. : j'appelle une pharmacie pour savoir si elle a un médicament" />
        <button className="primary big" type="submit">Préparer la séance</button>
      </form>
      <section className="stack">
        <p className="eyebrow">Idées</p>
        <ul className="list">
          {IDEAS.map((i) => (
            <li key={i}>
              <Link href={`/pratique/theme?sujet=${encodeURIComponent(i)}`}>
                <span className="grow">{i}</span>
                <span className="muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
