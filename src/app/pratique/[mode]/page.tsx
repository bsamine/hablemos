import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import {
  customSpec,
  duoSpec,
  checkupSpec,
  deleSpec,
  interviewSpec,
  pictureSpec,
  prepSpec,
  storySpec,
  redoSpec,
  reviewSpec,
  shadowingSpec,
  type SessionSpec,
  type StartRequest,
} from "@/lib/modes";
import { getProfile } from "@/lib/profile";
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
  searchParams: Promise<{ from?: string; sujet?: string; offre?: string; jeu?: string; event?: string; scene?: string; niveau?: string }>;
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
  } else if (mode === "entretien") {
    spec = interviewSpec(Number(q.offre));
    start = { mode: "interview", jobAdId: Number(q.offre) };
    empty = "Offre introuvable. Ajoute-la depuis l'onglet Entretiens.";
  } else if (mode === "duo") {
    const p = getProfile();
    if (!p.partner || !q.jeu)
      return <PartnerForm current={p.partner} next={q.jeu ? `/pratique/duo?jeu=${q.jeu}` : "/vie-reelle"} />;
    spec = duoSpec(String(q.jeu));
    start = { mode: "duo", game: String(q.jeu) };
    empty = "Choisis un jeu dans l'onglet Vie réelle.";
  } else if (mode === "prep") {
    spec = prepSpec(Number(q.event));
    start = { mode: "prep", eventId: Number(q.event) };
    empty = "Moment introuvable.";
  } else if (mode === "histoire") {
    spec = storySpec();
    start = { mode: "story" };
  } else if (mode === "image") {
    spec = pictureSpec(q.scene);
    start = { mode: "picture", sceneId: spec?.sceneId };
  } else if (mode === "bilan") {
    spec = checkupSpec();
    start = { mode: "checkup" };
  } else if (mode === "dele") {
    spec = deleSpec(String(q.niveau ?? "A2"));
    start = { mode: "dele", level: String(q.niveau ?? "A2") };
    empty = "Niveau DELE non disponible (A2 ou B1).";
  } else if (mode === "shadowing") {
    spec = shadowingSpec();
    start = { mode: "shadowing" };
    empty = "Fais d'abord une leçon : le shadowing utilise tes phrases.";
  } else notFound();

  const back =
    mode === "entretien" || mode === "dele"
      ? "/entretiens"
      : mode === "prep"
        ? `/moment/${q.event}`
        : mode === "duo" || mode === "theme"
          ? "/vie-reelle"
          : "/lecons";

  return (
    <div className="stack">
      <header className="top">
        <Link href={back} className="link">‹ Retour</Link>
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
              wordsLabel:
                mode === "revision"
                  ? "Les mots à retrouver (cache-les si tu veux jouer !)"
                  : mode === "histoire"
                    ? "Mots à réviser cachés dans l'épisode"
                    : undefined,
              image: spec.sceneId ? `/api/scene/${spec.sceneId}` : undefined,
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

function PartnerForm({ current, next }: { current: string; next: string }) {
  return (
    <div className="stack">
      <header className="top">
        <Link href="/vie-reelle" className="link">‹ Retour</Link>
      </header>
      <h1>Mode duo</h1>
      <p className="muted">Vous parlez à deux dans le même micro, Carla anime. Comment s'appelle ton partenaire ?</p>
      <form action="/api/profile" method="post" className="stack">
        <input name="partner" required maxLength={60} defaultValue={current} placeholder="Prénom de ton partenaire" />
        <input type="hidden" name="next" value={next} />
        <button className="primary big" type="submit">Continuer</button>
      </form>
    </div>
  );
}

function ThemeForm() {
  return (
    <div className="stack">
      <header className="top">
        <Link href="/vie-reelle" className="link">‹ Retour</Link>
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
