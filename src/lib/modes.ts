import { db, type SessionRow, type WordRow } from "./db";
import { getEvent, type Pocket } from "./events";
import { getJobAd } from "./jobs";
import { getProfile } from "./profile";
import { dueWords } from "./learning";
import type { Feedback } from "./prompts";
import { getScenario, SCENARIOS, type Scenario, type TargetWord } from "./scenarios";

export type Mode =
  | "scenario"
  | "redo"
  | "review"
  | "custom"
  | "interview"
  | "duo"
  | "shadowing"
  | "prep"
  | "story"
  | "picture"
  | "checkup"
  | "dele";

/** Which area of the app a mode belongs to. */
export const AREA: Record<Mode, "lecons" | "entretiens" | "vie-reelle"> = {
  scenario: "lecons",
  redo: "lecons",
  review: "lecons",
  shadowing: "lecons",
  interview: "entretiens",
  custom: "vie-reelle",
  duo: "vie-reelle",
  prep: "vie-reelle",
  story: "lecons",
  picture: "lecons",
  checkup: "lecons",
  dele: "entretiens",
};

/** Everything a live session needs; stored with the session so the debrief and history can use it. */
export type SessionSpec = {
  mode: Mode;
  scenarioId?: string;
  fromSessionId?: number;
  jobAdId?: number;
  duoGame?: string;
  eventId?: number;
  episode?: number;
  sceneId?: string;
  deleLevel?: string;
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
  | { mode: "shadowing" }
  | { mode: "prep"; eventId: number }
  | { mode: "story" }
  | { mode: "picture"; sceneId?: string }
  | { mode: "checkup" }
  | { mode: "dele"; level: string };

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

// ---------- Telenovela ----------

/** Interactive audio series: she is the main character and steers the plot by speaking. */
export function storySpec(): SessionSpec {
  const p = getProfile();
  const prev = db()
    .prepare("SELECT feedback FROM sessions WHERE mode = 'story' AND feedback IS NOT NULL ORDER BY started_at ASC")
    .all() as { feedback: string }[];
  const episode = prev.length + 1;
  const recap = prev
    .slice(-4)
    .map((r, i) => `Épisode ${episode - Math.min(prev.length, 4) + i} : ${(JSON.parse(r.feedback) as Feedback).memory_note ?? ""}`)
    .join("\n");
  const due: WordRow[] = dueWords(5);
  const hero = p.name || "la protagoniste";
  return {
    mode: "story",
    episode,
    title: `Telenovela · Episodio ${episode}`,
    titleFr: "Una farmacéutica en Madrid",
    taskGoal: `Vivre l'épisode ${episode} de la série dont tu es l'héroïne, et décider de la suite en parlant.`,
    persona: "Carla, narratrice et tous les personnages",
    focus: "écoute et décisions à l'oral",
    words: due.map((w) => ({ word: w.word, fr: w.translation, example: w.example })),
    minutes: 10,
    plan: `Tu es la NARRATRICE d'une telenovela audio, « Una farmacéutica en Madrid », dont l'héroïne est ${hero} elle-même : une pharmacienne française qui commence une nouvelle vie à Madrid. Ton ton : chaleureux, drôle, un peu dramatique, comme une vraie série.
${episode === 1 ? "C'est le PREMIER épisode : présente l'héroïne, son arrivée à Madrid et 2 personnages récurrents (une voisine bavarde, un collègue mystérieux)." : `RÉSUMÉ DES ÉPISODES PRÉCÉDENTS (garde la continuité, reprends les mêmes personnages) :\n${recap}`}

DÉROULÉ (environ 10 min) :
1. « Previously… » : 2 phrases de rappel en espagnol simple (ou de présentation pour l'épisode 1).
2. Raconte l'épisode en courtes scènes (3-4 phrases à la fois, niveau ${p.level}), avec des voix de personnages variées. Glisse les mots à réviser dans l'histoire.
3. À 3 moments clés, arrête-toi et demande-lui de DÉCIDER en espagnol ce que fait l'héroïne (« ¿Qué haces? ¿Aceptas la invitación o no? ») ou de répondre à un personnage. Sa réponse change vraiment la suite.
4. Corrige ses erreurs importantes très brièvement, sans casser la magie (« Casi : se dice… ¡Sigamos! »).
5. Termine sur un cliffhanger en espagnol, puis en français : « Fin de l'épisode ${episode}. Ton bilan s'affiche à l'écran. »`,
  };
}

// ---------- Describe the picture ----------

export const SCENES: { id: string; title: string; titleFr: string; prompt: string; description: string; level: string }[] = [
  { id: "mercado", title: "En el mercado", titleFr: "Au marché", level: "A1", prompt: "A lively covered food market in Madrid, fruit and vegetable stalls, a smiling vendor weighing tomatoes, a young woman with a tote bag, an old man with a cap, warm morning light", description: "Un marché couvert à Madrid : étals de fruits et légumes, une vendeuse qui pèse des tomates, une jeune femme avec un sac en tissu, un vieil homme avec une casquette, lumière du matin." },
  { id: "farmacia", title: "En la farmacia", titleFr: "À la pharmacie", level: "A1", prompt: "Inside a modern Spanish pharmacy with a green cross sign, a pharmacist in a white coat behind the counter talking to an elderly lady, shelves of products, a mother with a child waiting", description: "Une pharmacie espagnole moderne : une pharmacienne en blouse blanche au comptoir parle avec une dame âgée, des étagères de produits, une mère et son enfant qui attendent." },
  { id: "terraza", title: "Una terraza", titleFr: "Une terrasse", level: "A1", prompt: "A sunny café terrace on a Madrid square, friends sharing tapas and drinks, a waiter carrying a tray, a dog under a table, people walking by", description: "Une terrasse ensoleillée sur une place de Madrid : des amis partagent des tapas, un serveur porte un plateau, un chien sous une table, des passants." },
  { id: "metro", title: "En el metro", titleFr: "Dans le métro", level: "A2", prompt: "Madrid metro platform at rush hour, people waiting, a man reading a newspaper, a student with headphones, a woman checking the map, a train arriving", description: "Un quai du métro de Madrid à l'heure de pointe : un homme lit le journal, une étudiante avec un casque, une femme regarde le plan, un train arrive." },
  { id: "parque", title: "El Retiro un domingo", titleFr: "Le Retiro un dimanche", level: "A2", prompt: "Retiro park in Madrid on a Sunday, rowing boats on the lake, families picnicking on the grass, a street musician playing guitar, joggers, autumn trees", description: "Le parc du Retiro un dimanche : des barques sur le lac, des familles qui pique-niquent, un musicien qui joue de la guitare, des joggeurs, des arbres d'automne." },
  { id: "oficina", title: "Una reunión", titleFr: "Une réunion", level: "B1", prompt: "A modern office meeting room, five colleagues around a table, one woman presenting a chart on a screen, laptops and coffee cups, one person looking at their phone", description: "Une salle de réunion moderne : cinq collègues autour d'une table, une femme présente un graphique à l'écran, des ordinateurs et des cafés, une personne regarde son téléphone." },
  { id: "cocina", title: "Cocinar en casa", titleFr: "Cuisiner à la maison", level: "A2", prompt: "A cozy home kitchen, a couple cooking together, a pan of paella on the stove, vegetables on a cutting board, a recipe on a tablet, evening light", description: "Une cuisine chaleureuse : un couple cuisine ensemble, une paella sur le feu, des légumes sur une planche, une recette sur une tablette, lumière du soir." },
  { id: "estacion", title: "En la estación", titleFr: "À la gare", level: "A2", prompt: "Atocha train station in Madrid with its tropical garden, travelers with suitcases, a departures board, a couple saying goodbye, a ticket machine", description: "La gare d'Atocha à Madrid avec son jardin tropical : des voyageurs avec des valises, un panneau des départs, un couple qui se dit au revoir, un distributeur de billets." },
];

/** She describes a generated scene; Carla knows what is in it and asks questions. */
export function pictureSpec(sceneId?: string): SessionSpec | null {
  const seen = new Set(
    (db().prepare("SELECT spec FROM sessions WHERE mode = 'picture' AND transcript IS NOT NULL").all() as { spec: string }[]).map(
      (r) => (JSON.parse(r.spec) as SessionSpec).sceneId,
    ),
  );
  const scene = SCENES.find((x) => x.id === sceneId) ?? SCENES.find((x) => !seen.has(x.id)) ?? SCENES[0];
  return {
    mode: "picture",
    sceneId: scene.id,
    title: `Describe: ${scene.title}`,
    titleFr: `Décrire l'image · ${scene.titleFr}`,
    taskGoal: "Décrire l'image à Carla : qui, où, ce que font les gens, ce qu'ils ressentent, puis imaginer la suite.",
    persona: "Carla, sa professeure",
    focus: "décrire, hay, estar + gerundio",
    words: [],
    minutes: 7,
    plan: `Elle regarde une image sur son écran. Toi tu ne la vois pas, mais voici exactement ce qu'elle montre : ${scene.description}
1. Explique en une phrase en français : elle décrit l'image, tu poses des questions.
2. Donne 4 outils utiles, un par un, et fais-les répéter : « En la imagen hay… », « A la izquierda / a la derecha… », « Está + gerundio (está comprando) », « Parece que… ».
3. Elle décrit. Pose des questions précises sur des détails réels de l'image (« ¿Qué lleva el señor? ¿Qué está haciendo la vendedora? »). Si elle invente un détail absent, dis-le gentiment.
4. Puis imaginez ensemble : « ¿Qué va a pasar después? ¿Quiénes son? ».
5. Fin : félicite-la en français et dis-lui que son bilan s'affiche à l'écran.`,
  };
}

// ---------- Monthly level check ----------

export function checkupSpec(): SessionSpec {
  const { level } = getProfile();
  return {
    mode: "checkup",
    title: "Bilan de niveau",
    titleFr: "Le check-up du mois",
    taskGoal: "Un court test oral en 4 parties pour mesurer ton niveau ce mois-ci et voir tes progrès.",
    persona: "Carla, examinatrice bienveillante",
    focus: "évaluation",
    words: [],
    minutes: 12,
    plan: `Tu fais passer un BILAN DE NIVEAU oral d'environ 10 minutes, bienveillant mais rigoureux. Niveau déclaré : ${level}. Ne corrige PAS pendant le test (tu corrigeras à la fin) : ton rôle est d'évaluer.
Explique en français : « 4 petites parties, je ne corrige pas pendant, détends-toi. »
1. Présentation (2 min) : qui elle est, sa vie, son travail. Relances simples.
2. Description (2 min) : sa maison, son quartier ou une personne qu'elle aime.
3. Interaction (3 min) : un mini jeu de rôle du quotidien adapté au niveau (au restaurant, à la pharmacie, prendre rendez-vous).
4. Opinion / récit (3 min) : ${level === "A1" ? "ce qu'elle aime et n'aime pas" : level === "A2" ? "raconter son dernier week-end ou un souvenir" : "donner son avis sur un sujet de société simple et justifier"}.
Pour chaque partie, monte légèrement la difficulté si elle s'en sort bien, pour trouver son vrai plafond.
Fin : en français, 2 points forts et le point prioritaire à travailler. Dis-lui que sa carte de niveau s'affiche à l'écran.`,
  };
}

// ---------- DELE-style oral exam ----------

export function deleSpec(level: string): SessionSpec | null {
  if (level !== "A2" && level !== "B1") return null;
  const a2 = level === "A2";
  return {
    mode: "dele",
    deleLevel: level,
    title: `Simulacro DELE ${level} · oral`,
    titleFr: `Entraînement à l'oral du DELE ${level}`,
    taskGoal: `Passer une épreuve orale inspirée du format du DELE ${level}, avec un temps de préparation et une note indicative.`,
    persona: "une examinatrice officielle, cordiale et neutre",
    focus: "examen",
    words: [],
    minutes: 15,
    plan: `Tu es l'examinatrice d'un SIMULACRE d'épreuve orale inspirée du DELE ${level} (format simplifié pour l'entraînement ; dis-le au début, en français). Reste neutre et cordiale comme une vraie examinatrice. Ne corrige pas pendant l'épreuve.
${
  a2
    ? `Tarea 1 — Monólogo (2-3 min) : propose 2 sujets (ex. « Tu ciudad », « Tus vacaciones ») ; elle en choisit un, tu lui laisses 1 minute pour réfléchir (dis « Tiene un minuto para prepararse », puis attends qu'elle dise « listo »), puis elle parle sans interruption.
Tarea 2 — Descripción (2 min) : décris oralement une scène simple qu'elle doit imaginer (« Imagine una foto: una familia en un parque… ») et demande-lui de la décrire et d'imaginer qui sont ces personnes.
Tarea 3 — Diálogo (3 min) : jeu de rôle en situation (tu es employée d'une agence de voyages ou d'un magasin), elle doit obtenir une information et réagir.
Tarea 4 — Conversación (2 min) : questions personnelles liées aux tâches précédentes.`
    : `Tarea 1 — Presentación (2-3 min) : propose 2 sujets d'opinion (ex. « El teletrabajo », « Vivir en el extranjero ») ; 1 minute de préparation (attends « listo »), puis exposé avec introduction, opinion, exemple, conclusion.
Tarea 2 — Conversación sobre la presentación (3 min) : pose des questions qui la font justifier et nuancer.
Tarea 3 — Descripción de una situación (3 min) : décris une scène à imaginer (« una reunión de trabajo con un problema ») ; elle décrit, interprète et imagine la suite.
Tarea 4 — Situación simulada (3 min) : jeu de rôle avec un petit conflit à résoudre (réclamation, changement de rendez-vous).`
}
Annonce chaque tâche clairement en espagnol (« Tarea 1 ») avec la consigne. Garde le rythme et le minutage.
Fin : sors du rôle et, en français, dis-lui que sa note indicative et les conseils s'affichent à l'écran.`,
  };
}

/** Dress rehearsal of a real moment coming up in her week. */
export function prepSpec(eventId: number): SessionSpec | null {
  const ev = getEvent(eventId);
  if (!ev) return null;
  const when = new Date(ev.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  if (ev.job_ad_id) {
    const base = interviewSpec(ev.job_ad_id);
    if (base)
      return {
        ...base,
        mode: "prep",
        eventId,
        title: `Répétition : ${ev.title}`,
        titleFr: `Répétition générale avant le ${when}`,
        plan: `C'est la RÉPÉTITION GÉNÉRALE de son vrai entretien, prévu ${when}. Rends-le aussi réaliste que possible.\n\n${base.plan}`,
      };
  }
  const pocket: Pocket | null = ev.pocket ? JSON.parse(ev.pocket) : null;
  const words = (pocket?.phrases ?? []).map((p) => ({ word: p.es, fr: p.fr, example: "" }));
  return {
    mode: "prep",
    eventId,
    title: `Répétition : ${ev.title}`,
    titleFr: `Répétition générale avant le ${when}`,
    taskGoal: `Se préparer au moment réel « ${ev.title} » (${when}) en le jouant deux fois avec Carla.`,
    persona: "les personnes qu'elle va rencontrer",
    focus: "préparation d'un moment réel",
    words,
    minutes: 10,
    plan: `C'est la répétition générale d'un VRAI moment de sa vie, prévu ${when} : « ${ev.title} ».
Contexte qu'elle a donné : ${ev.details || "aucun détail"}.
${pocket ? `Sa carte de poche (phrases à lui faire utiliser) : ${pocket.phrases.map((p) => p.es).join(" / ")}. Sa première phrase prévue : « ${pocket.opener_es} ».` : "Choisis toi-même les 5 phrases les plus utiles et présente-les au début."}

1. En une phrase en français, dis-lui que vous allez répéter ce moment deux fois, et demande-lui ce qui l'inquiète le plus.
2. Premier passage (avec aide) : joue la ou les personnes réalistes de cette situation. Aide-la, corrige comme d'habitude.
3. Ajoute UN imprévu réaliste (tu parles trop vite, tu poses une question inattendue, il manque quelque chose) pour qu'elle utilise une phrase de secours.
4. Second passage (sans aide) : rejoue le moment d'un trait, sans corriger pendant ; corrige seulement à la fin, les 2 points les plus importants.
5. Fin : en français, encourage-la pour le jour J en une phrase et rappelle-lui de raconter ensuite comment ça s'est passé dans l'appli.`,
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

/** Sentences she already met (her words' examples), topped up from lessons at her level. */
export function practiceSentences(n = 8): string[] {
  const { level } = getProfile();
  const rows = db()
    .prepare("SELECT * FROM words WHERE example <> '' ORDER BY due_at ASC LIMIT ?")
    .all(n) as WordRow[];
  let sentences = rows.map((w) => w.example);
  if (sentences.length < 5) {
    const extra = getScenarioPool(level).flatMap((s) => s.words.map((w) => w.example)).filter(Boolean);
    sentences = [...new Set([...sentences, ...extra])].slice(0, n);
  }
  return sentences;
}

/** Repeat-after-me practice on sentences she already met. */
export function shadowingSpec(): SessionSpec | null {
  const sentences = practiceSentences(8);
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
    case "prep":
      return prepSpec(Number(req.eventId));
    case "story":
      return storySpec();
    case "picture":
      return pictureSpec(req.sceneId);
    case "checkup":
      return checkupSpec();
    case "dele":
      return deleSpec(String(req.level));
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
