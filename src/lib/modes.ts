import { db, type SessionRow, type WordRow } from "./db";
import { getJobAd } from "./jobs";
import { getProfile } from "./profile";
import { dueWords } from "./learning";
import type { Feedback } from "./prompts";
import { getScenario, SCENARIOS, type Scenario, type TargetWord } from "./scenarios";

export type Mode = "scenario" | "redo" | "review" | "custom" | "interview" | "duo" | "shadowing";

/** Which area of the app a mode belongs to. */
export const AREA: Record<Mode, "lecons" | "entretiens" | "vie-reelle"> = {
  scenario: "lecons",
  redo: "lecons",
  review: "lecons",
  shadowing: "lecons",
  interview: "entretiens",
  custom: "vie-reelle",
  duo: "vie-reelle",
};

/** Everything a live session needs; stored with the session so the debrief and history can use it. */
export type SessionSpec = {
  mode: Mode;
  scenarioId?: string;
  fromSessionId?: number;
  jobAdId?: number;
  duoGame?: string;
  title: string; // shown in Spanish
  titleFr: string;
  taskGoal: string; // French, read by the learner and the tutor
  persona: string;
  focus: string;
  words: TargetWord[];
  minutes: number;
  /** The session plan given to Carla (French). */
  plan: string;
};

export type StartRequest =
  | { mode: "scenario"; scenarioId: string }
  | { mode: "redo"; fromSessionId: number }
  | { mode: "review" }
  | { mode: "custom"; topic: string }
  | { mode: "interview"; jobAdId: number }
  | { mode: "duo"; game: string }
  | { mode: "shadowing" };

const defaultMinutes = () => Number(process.env.SESSION_MINUTES ?? 15);

export function scenarioSpec(s: Scenario): SessionSpec {
  const minutes = defaultMinutes();
  return {
    mode: "scenario",
    scenarioId: s.id,
    title: s.title,
    titleFr: s.titleFr,
    taskGoal: s.taskGoal,
    persona: s.persona,
    focus: s.focus,
    words: s.words,
    minutes,
    plan: `1. Échauffement (1-2 min) : salue-la par son prénom, demande-lui de ses nouvelles en reprenant ce que tu sais d'elle, et fais-lui utiliser 2 ou 3 mots à réviser.
2. Préparation (2 min) : présente la tâche du jour en une phrase en français, puis les 5 mots du jour. Pour chaque mot : le mot en espagnol, le sens en français, l'exemple. Elle répète chaque mot.
3. Tâche (8-10 min) : jeu de rôle ou conversation sur le thème. Tu joues : ${s.persona}. Fais-lui réutiliser les mots du jour.
4. Refaire (1-2 min) : redemande-lui la phrase clé de la tâche, pour qu'elle la dise correctement d'un trait.
5. Fin : quand elle dit "fin de la sesión" ou après environ ${minutes} minutes, félicite-la en une phrase en français et dis-lui que son bilan s'affiche à l'écran. Ne fais PAS le bilan à l'oral.`,
  };
}

/** Spoken drill of the corrections and better phrasings of a past session. */
export function redoSpec(fromSessionId: number): SessionSpec | null {
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(fromSessionId) as SessionRow | undefined;
  if (!row?.feedback) return null;
  const fb = JSON.parse(row.feedback) as Feedback;
  const items = [
    ...(fb.errors ?? []).map((e) => ({ said: e.learner_said, good: e.correction, why: e.rule_fr })),
    ...(fb.upgrades ?? []).map((u) => ({ said: u.learner_said, good: u.better, why: u.why_fr })),
  ].filter((i) => i.good);
  if (!items.length) return null;
  const from = sessionTitle(row);
  const list = items.map((i, n) => `${n + 1}. Elle avait dit « ${i.said} » → forme correcte : « ${i.good} » (${i.why})`).join("\n");
  return {
    mode: "redo",
    fromSessionId,
    title: `Refaire : ${from}`,
    titleFr: "Redire mes corrections à l'oral",
    taskGoal: `Redire à voix haute les ${items.length} phrases corrigées de la séance « ${from} », jusqu'à ce qu'elles sortent toutes seules.`,
    persona: "Carla, sa professeure",
    focus: "corrections de la dernière séance",
    words: [],
    minutes: 5,
    plan: `C'est une séance courte (environ 5 minutes) d'entraînement sur ses corrections. Pas de nouveau thème.
Les phrases à travailler :
${list}

Pour chaque phrase, dans l'ordre :
1. Rappelle le contexte en français en une phrase courte (ex. : « Tu voulais dire que tu habites à Lyon. »), sans donner la réponse.
2. Elle essaie de dire la phrase en espagnol.
3. Si c'est correct : « ¡Perfecto! » puis demande-lui une variante avec un autre mot (ex. autre ville, autre personne).
   Si ce n'est pas correct : dis la forme correcte lentement, rappelle la règle en 10 mots maximum en français, et demande-lui de répéter.
4. Passe à la phrase suivante.
À la fin, refais rapidement les 2 phrases qui ont été les plus difficiles, félicite-la en français et dis-lui que son bilan s'affiche à l'écran.`,
  };
}

/** Quick active recall of the words due today. */
export function reviewSpec(): SessionSpec | null {
  const due: WordRow[] = dueWords(8);
  if (!due.length) return null;
  return {
    mode: "review",
    title: "Révision express",
    titleFr: `${due.length} mots à revoir`,
    taskGoal: `Retrouver et utiliser à l'oral ${due.length} mots appris dans les séances précédentes.`,
    persona: "Carla, sa professeure",
    focus: "mots à réviser",
    words: due.map((w) => ({ word: w.word, fr: w.translation, example: w.example })),
    minutes: 4,
    plan: `C'est une révision express d'environ 4 minutes. Pour chaque mot du jour, dans l'ordre :
1. Donne le sens en français (« Comment on dit "l'addition" ? ») ou une petite situation, sans dire le mot espagnol.
2. Elle doit trouver le mot. Si elle ne trouve pas après un essai, donne un indice (première syllabe), puis la réponse.
3. Demande-lui une phrase courte avec ce mot, liée à sa vie (utilise ce que tu sais d'elle). Corrige si besoin et fais répéter.
Garde un rythme rapide et joyeux, comme un jeu. À la fin, dis-lui combien de mots elle a trouvés seule, félicite-la en français et dis-lui que son bilan s'affiche à l'écran.`,
  };
}

/** A role-play on a situation she describes herself. */
export function customSpec(topic: string): SessionSpec | null {
  const t = topic.trim().slice(0, 300);
  if (t.length < 3) return null;
  const minutes = Math.min(defaultMinutes(), 12);
  return {
    mode: "custom",
    title: "Mon thème",
    titleFr: t,
    taskGoal: t,
    persona: "le personnage qui correspond le mieux à la situation",
    focus: "situation choisie par l'apprenante",
    words: [],
    minutes,
    plan: `Elle a choisi elle-même la situation à travailler : « ${t} ».
1. Reformule la situation en une phrase en français et propose qui tu vas jouer (le personnage le plus utile). Demande-lui si ça lui va.
2. Choisis toi-même les 5 mots ou expressions les plus utiles pour cette situation, adaptés à son niveau. Présente-les un par un (espagnol, sens en français, exemple court) ; elle répète chaque mot.
3. Jeu de rôle (6-8 min) : joue le personnage de façon réaliste, en espagnol d'Espagne. Fais-lui utiliser les 5 mots.
4. Refaire (1 min) : fais-lui redire la phrase la plus utile de la situation, d'un trait.
5. Fin : quand elle dit "fin de la sesión" ou après environ ${minutes} minutes, félicite-la en français et dis-lui que son bilan s'affiche à l'écran.`,
  };
}

/** Mock interview for a real job ad she pasted. */
export function interviewSpec(jobAdId: number): SessionSpec | null {
  const ad = getJobAd(jobAdId);
  if (!ad) return null;
  const { level } = getProfile();
  const beginner = level === "A1" || level === "A2";
  const company = ad.company || "l'entreprise";
  return {
    mode: "interview",
    jobAdId,
    title: `Entretien : ${ad.title}`,
    titleFr: ad.company ? `Simulation chez ${ad.company}` : "Simulation d'entretien",
    taskGoal: `Passer un entretien en espagnol pour le poste « ${ad.title} »${ad.company ? ` chez ${ad.company}` : ""} et convaincre la recruteuse.`,
    persona: `une recruteuse de ${company}`,
    focus: "entretien d'embauche",
    words: [],
    minutes: 15,
    plan: `Tu joues une recruteuse de ${company} qui fait passer un entretien pour le poste « ${ad.title} ».
L'OFFRE (lis-la attentivement, tes questions doivent s'y rapporter) :
"""
${ad.text.slice(0, 3000)}
"""

${
  beginner
    ? `ADAPTATION AU NIVEAU (${level}) : entretien réaliste mais accessible. Pose des questions courtes et lentes, une à la fois. Avant une question difficile, donne-lui en français une expression utile pour commencer sa réponse (ex. « Tu peux commencer par : Tengo experiencia en… »). Elle peut demander un mot en français.`
    : `NIVEAU (${level}) : entretien réaliste, rythme naturel, relances quand la réponse est vague (« ¿Me puede dar un ejemplo concreto? »).`
}

DÉROULÉ (12-15 min) :
1. Accueil : salue-la, présente-toi (prénom inventé, poste RH), une question pour briser la glace.
2. « Háblame de ti » : son parcours.
3. Motivation : pourquoi ce poste et cette entreprise ; relie à l'offre.
4. Deux questions sur son expérience, liées aux exigences de l'offre.
5. Une question de mise en situation (une priorité, un conflit, une erreur).
6. Questions pratiques : disponibilité, mobilité, langues.
7. « ¿Tiene alguna pregunta para nosotros? » : laisse-la poser ses questions et réponds de façon crédible.
8. Clôture en espagnol. Puis SORS DU RÔLE et, en français : 2 points forts et 1 conseil prioritaire, et dis-lui que son bilan détaillé s'affiche à l'écran.

CORRECTION PENDANT L'ENTRETIEN : reste dans ton rôle. Ne l'interromps pas au milieu d'une réponse. Après une réponse avec une erreur importante, sors du rôle 3 secondes : « (Petit conseil : on dit « he trabajado ». Seguimos.) »${beginner ? " — fais-le à chaque erreur importante." : " — seulement pour les erreurs qui gênent le sens."}
Utilise ce que tu sais d'elle (parcours, métier) pour des questions crédibles, sans inventer de faits.`,
  };
}

export const DUO_GAMES: { id: string; title: string; titleFr: string; goal: string }[] = [
  {
    id: "conocernos",
    title: "Preguntas para conocernos",
    titleFr: "Questions pour mieux se connaître",
    goal: "Se poser à tour de rôle des questions qu'on ne s'est jamais posées (souvenirs, rêves, petites manies).",
  },
  {
    id: "viaje",
    title: "Planear un viaje juntos",
    titleFr: "Préparer un voyage à deux",
    goal: "Choisir ensemble une destination en Espagne et organiser 3 jours : transport, logement, activités, budget.",
  },
  {
    id: "debate",
    title: "Debate amistoso",
    titleFr: "Débats légers",
    goal: "Débattre de questions légères (playa o montaña, cocinar o salir, madrugar o trasnochar) et défendre son camp.",
  },
  {
    id: "restaurante",
    title: "Cena en Madrid",
    titleFr: "Dîner au restaurant",
    goal: "Jeu de rôle au restaurant : l'un commande, l'autre est serveur, Carla crée des imprévus.",
  },
];

/** Both partners speak Spanish together; Carla hosts and coaches the learner. */
export function duoSpec(game: string): SessionSpec | null {
  const g = DUO_GAMES.find((x) => x.id === game);
  if (!g) return null;
  const p = getProfile();
  const learner = p.name || "l'élève";
  const partner = p.partner || "son partenaire";
  return {
    mode: "duo",
    duoGame: g.id,
    title: `Duo : ${g.title}`,
    titleFr: g.titleFr,
    taskGoal: g.goal,
    persona: "Carla, l'animatrice du jeu",
    focus: "conversation à deux",
    words: [],
    minutes: 12,
    plan: `SÉANCE EN DUO : deux personnes parlent dans le même micro.
- ${learner} est ton élève (niveau ${p.level}).
- ${partner} parle très bien espagnol et l'aide.
Tu es l'animatrice du jeu « ${g.title} » : ${g.goal}

RÈGLES DU DUO :
1. Explique le jeu en une phrase en français, puis lance-le en espagnol.
2. Interpelle chacun par son prénom pour qu'on sache qui doit parler (« ${learner}, pregúntale a ${partner}… »). ${learner} doit parler au moins autant que ${partner}.
3. Demande à ${partner} de parler simplement, et de l'aider en reformulant plutôt qu'en répondant à sa place.
4. Corrige seulement ${learner}, brièvement, à sa façon habituelle (« Casi… », règle en français en 10 mots, elle répète). Ne corrige pas ${partner}.
5. Relance le jeu avec des cartes : questions, imprévus, petits défis (« 30 secondes sans français »). Compte des points pour rire.
6. Après environ 10 minutes, annonce le score, félicite-les en français, et dis-leur que le bilan de ${learner} s'affiche à l'écran.`,
  };
}

/** Repeat-after-me practice on sentences she already met. */
export function shadowingSpec(): SessionSpec | null {
  const { level } = getProfile();
  const rows = db()
    .prepare("SELECT * FROM words WHERE example <> '' ORDER BY due_at ASC LIMIT 8")
    .all() as WordRow[];
  let sentences = rows.map((w) => w.example);
  if (sentences.length < 5) {
    const extra = getScenarioPool(level).flatMap((s) => s.words.map((w) => w.example)).filter(Boolean);
    sentences = [...new Set([...sentences, ...extra])].slice(0, 8);
  }
  if (!sentences.length) return null;
  return {
    mode: "shadowing",
    title: "Shadowing",
    titleFr: "Répéter après Carla",
    taskGoal: `Répéter ${sentences.length} phrases juste après Carla, d'abord lentement puis à vitesse normale, pour l'accent et la fluidité.`,
    persona: "Carla, sa professeure",
    focus: "prononciation et rythme",
    words: [],
    minutes: 5,
    plan: `Exercice de shadowing d'environ 5 minutes. Les phrases :
${sentences.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Explique en une phrase en français : « Je dis une phrase, tu la répètes tout de suite, en imitant ma musique. »
Pour chaque phrase :
1. Dis-la lentement, en articulant. Elle répète.
2. Dis-la à vitesse naturelle, avec l'intonation de Madrid. Elle répète.
3. Si sa répétition (transcrite) oublie ou change des mots, dis lesquels en une phrase, puis fais répéter une dernière fois.
4. Un mot d'encouragement et phrase suivante. Pas de longues explications : le rythme compte.
À la fin, choisis la phrase la plus difficile et fais-la répéter 3 fois de plus en accélérant. Félicite-la en français et dis-lui que son bilan s'affiche à l'écran.`,
  };
}

function getScenarioPool(level: string): Scenario[] {
  return SCENARIOS.filter((s) => s.level === level).slice(0, 3);
}

export function buildSpec(req: StartRequest): SessionSpec | null {
  switch (req.mode) {
    case "interview":
      return interviewSpec(Number(req.jobAdId));
    case "duo":
      return duoSpec(String(req.game ?? ""));
    case "shadowing":
      return shadowingSpec();
    case "scenario": {
      const s = getScenario(req.scenarioId);
      return s ? scenarioSpec(s) : null;
    }
    case "redo":
      return redoSpec(Number(req.fromSessionId));
    case "review":
      return reviewSpec();
    case "custom":
      return customSpec(String(req.topic ?? ""));
  }
  return null;
}

/** The spec stored with a session, or rebuilt for sessions created before specs existed. */
export function sessionSpec(row: SessionRow): SessionSpec | null {
  if (row.spec) return JSON.parse(row.spec) as SessionSpec;
  const s = getScenario(row.scenario_id);
  return s ? scenarioSpec(s) : null;
}

export function sessionTitle(row: SessionRow): string {
  return sessionSpec(row)?.title ?? row.scenario_id;
}
