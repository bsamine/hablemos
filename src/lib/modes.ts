import { db, type SessionRow, type WordRow } from "./db";
import { dueWords } from "./learning";
import type { Feedback } from "./prompts";
import { getScenario, type Scenario, type TargetWord } from "./scenarios";

export type Mode = "scenario" | "redo" | "review" | "custom";

/** Everything a live session needs; stored with the session so the debrief and history can use it. */
export type SessionSpec = {
  mode: Mode;
  scenarioId?: string;
  fromSessionId?: number;
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
  | { mode: "custom"; topic: string };

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

export function buildSpec(req: StartRequest): SessionSpec | null {
  switch (req.mode) {
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
