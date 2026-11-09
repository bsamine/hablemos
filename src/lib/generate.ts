import { getCache, setCache, todayKey, weekKey } from "./cache";
import { db } from "./db";
import { getEvent, setPocket, type Pocket } from "./events";
import { generateJson } from "./gemini";
import { getJobAd } from "./jobs";
import { knownErrors } from "./learning";
import { getProfile, listFacts, recentNotes } from "./profile";

/** Everything Carla knows, in one paragraph, for generation prompts. */
export function learnerBrief(): string {
  const p = getProfile();
  return `Apprenante : ${p.name || "l'élève"}, francophone, niveau ${p.level} en espagnol (objectif B1), espagnol d'Espagne.
${p.about ? `Elle se décrit ainsi : ${p.about}\n` : ""}Faits connus : ${listFacts().slice(0, 20).map((f) => f.text).join(" ; ") || "peu de choses"}.
Erreurs fréquentes : ${knownErrors().join(" ; ") || "pas encore connues"}.`;
}

// ---------- Pocket card for a real event ----------

export async function generatePocket(eventId: number): Promise<Pocket> {
  const ev = getEvent(eventId);
  if (!ev) throw new Error("moment introuvable");
  const ad = ev.job_ad_id ? getJobAd(ev.job_ad_id) : undefined;
  const r = (await generateJson(`${learnerBrief()}
Elle a bientôt ce moment réel en espagnol : « ${ev.title} » le ${ev.date}. Type : ${ev.kind}. Détails : ${ev.details || "aucun"}.
${ad ? `Offre d'emploi liée : ${ad.title} ${ad.company ? `chez ${ad.company}` : ""}. ${ad.text.slice(0, 1500)}` : ""}
Prépare sa carte de poche, à lire sur son téléphone juste avant :
- opener_es : la toute première phrase qu'elle dira (naturelle, à son niveau).
- phrases : exactement 5 phrases essentielles pour ce moment, en espagnol à son niveau, chacune avec la traduction française. Inclure une phrase de secours pour demander de répéter ou de parler plus lentement.
- tip_fr : un conseil de comportement ou de culture espagnole pour ce moment (une phrase).
JSON strict : { "opener_es": "...", "phrases": [ { "es": "...", "fr": "..." } ], "tip_fr": "..." }`)) as Pocket;
  setPocket(eventId, r);
  return r;
}

// ---------- Interview pack for a job ad ----------

export type InterviewPack = {
  summary_fr: string;
  research_fr: string[];
  questions: { q_es: string; why_fr: string; model_answer_es: string }[];
  cheat_sheet: { es: string; fr: string }[];
  ask_them_es: string[];
};

export async function generateInterviewPack(jobAdId: number): Promise<InterviewPack> {
  const ad = getJobAd(jobAdId);
  if (!ad) throw new Error("offre introuvable");
  const r = (await generateJson(`${learnerBrief()}
Elle prépare un entretien en espagnol pour ce poste : « ${ad.title} »${ad.company ? ` chez ${ad.company}` : ""}.
OFFRE :
"""
${ad.text.slice(0, 4000)}
"""
Prépare son dossier d'entretien :
- summary_fr : en 2 phrases, ce que le recruteur cherche vraiment.
- research_fr : 4 points à vérifier sur l'entreprise avant l'entretien (site, produits, actualité, culture) — formulés comme une checklist, sans inventer de faits sur l'entreprise.
- questions : les 10 questions les plus probables pour CE poste (en espagnol), pourquoi on la pose (français, 12 mots max), et une réponse modèle en espagnol à SON niveau, crédible avec son profil, 2 à 4 phrases, sans inventer d'expérience qu'elle n'a pas (utilise des formulations ouvertes si besoin).
- cheat_sheet : 8 expressions utiles pour cet entretien (espagnol + français).
- ask_them_es : 3 questions intelligentes à poser au recruteur, en espagnol.
JSON strict : { "summary_fr": "...", "research_fr": ["..."], "questions": [ { "q_es": "...", "why_fr": "...", "model_answer_es": "..." } ], "cheat_sheet": [ { "es": "...", "fr": "..." } ], "ask_them_es": ["..."] }`)) as InterviewPack;
  db().prepare("UPDATE job_ads SET pack = ? WHERE id = ?").run(JSON.stringify(r), jobAdId);
  return r;
}

export { getCache, setCache, todayKey, weekKey, recentNotes };

// ---------- Living curriculum: the week's plan ----------

export type PlanItem = {
  day: string;
  kind: "lesson" | "review" | "shadowing" | "diary" | "prep" | "custom" | "story" | "picture" | "grammar" | "interview" | "podcast" | "missing";
  ref: string;
  title_fr: string;
  why_fr: string;
};
export type WeekPlan = { intro_fr: string; focus_fr: string; items: PlanItem[] };

export async function generateWeekPlan(): Promise<WeekPlan> {
  const { LESSONS } = await import("./scenarios");
  const { doneScenarioIds } = await import("./learning");
  const { listEvents } = await import("./events");
  const { listJobAds } = await import("./jobs");
  const done = doneScenarioIds();
  const { level } = getProfile();
  const nextLessons = LESSONS.filter((l) => !done.has(l.id)).slice(0, 8);
  const events = listEvents().upcoming.slice(0, 5);
  const ads = listJobAds().slice(0, 3);
  const missing = db()
    .prepare("SELECT result FROM voice_notes WHERE kind IN ('missing','debrief') AND status = 'done' ORDER BY id DESC LIMIT 5")
    .all() as { result: string }[];
  const r = (await generateJson(`${learnerBrief()}
Tu es Carla. Construis SON programme de la semaine (5 à 7 activités de 5 à 15 minutes), à partir de sa vie, pas d'un manuel.
Données :
- Moments réels à venir : ${events.map((e) => `[event:${e.id}] ${e.title} le ${e.date}`).join(" ; ") || "aucun"}
- Offres d'emploi : ${ads.map((a) => `[offre:${a.id}] ${a.title}`).join(" ; ") || "aucune"}
- Prochaines leçons disponibles (id : titre, niveau) : ${nextLessons.map((l) => `${l.id} : ${l.title} (${l.level})`).join(" ; ")}
- Ce qui lui a manqué récemment dans la vraie vie : ${missing.map((m) => m.result.slice(0, 300)).join(" | ") || "rien de noté"}
- Dernières séances : ${recentNotes(4).map((n) => `${n.title} : ${n.note}`).join(" ; ") || "aucune"}

Règles :
- Priorité 1 : préparer les moments réels à venir (kind "prep", ref = id du moment), la veille ou l'avant-veille.
- Priorité 2 : ses erreurs fréquentes (kind "grammar", ref = catégorie parmi verb_conjugation, gender_agreement, ser_estar, word_order, gustar, preposition, vocabulary) et ce qui lui a manqué (kind "custom", ref = une situation à jouer, en français).
- Ensuite : 1 ou 2 leçons (kind "lesson", ref = id exact d'une leçon de la liste), adaptées au niveau ${level}.
- Varie : au moins une activité courte parmi "review", "shadowing", "diary", "podcast", "story", "picture", "missing" (ref vide).
- Si une offre existe : une simulation (kind "interview", ref = id de l'offre).
- day : jour de la semaine en français (lundi… dimanche), en commençant par aujourd'hui (${new Date().toLocaleDateString("fr-FR", { weekday: "long", timeZone: "Europe/Paris" })}).
- why_fr : pourquoi c'est utile pour ELLE, en 12 mots max.
JSON strict : { "intro_fr": "1 phrase d'encouragement de Carla", "focus_fr": "le fil rouge de la semaine en 8 mots", "items": [ { "day": "...", "kind": "...", "ref": "...", "title_fr": "...", "why_fr": "..." } ] }`)) as WeekPlan;
  setCache(`plan:${weekKey()}`, r);
  return r;
}

export function planHref(i: PlanItem): string {
  switch (i.kind) {
    case "lesson":
      return `/session/${encodeURIComponent(i.ref)}`;
    case "review":
      return "/pratique/revision";
    case "shadowing":
      return "/pratique/shadowing";
    case "diary":
      return "/journal";
    case "prep":
      return `/moment/${encodeURIComponent(i.ref)}`;
    case "custom":
      return `/pratique/theme?sujet=${encodeURIComponent(i.ref || i.title_fr)}`;
    case "story":
      return "/pratique/histoire";
    case "picture":
      return "/pratique/image";
    case "grammar":
      return `/grammaire#${encodeURIComponent(i.ref)}`;
    case "interview":
      return `/pratique/entretien?offre=${encodeURIComponent(i.ref)}`;
    case "podcast":
      return "/podcast";
    case "missing":
      return "/carnet";
  }
  return "/";
}

// ---------- Grammar mini-cards ----------

export type GrammarCard = {
  title_fr: string;
  rule_fr: string;
  examples: { es: string; fr: string }[];
  pitfall_fr: string;
  drill_es: string[];
};

export async function generateGrammarCard(category: string): Promise<GrammarCard> {
  const { level } = getProfile();
  const examples = db()
    .prepare("SELECT learner_said, correction FROM errors WHERE category = ? ORDER BY id DESC LIMIT 5")
    .all(category) as { learner_said: string; correction: string }[];
  const r = (await generateJson(`${learnerBrief()}
Écris une fiche de grammaire très courte (lisible en 1 minute) sur le point « ${category} », pour une francophone de niveau ${level}.
Ses vraies erreurs sur ce point : ${examples.map((e) => `« ${e.learner_said} » → « ${e.correction} »`).join(" ; ") || "aucune encore"}.
- title_fr : titre court.
- rule_fr : la règle en 2-3 phrases simples, en comparant avec le français quand ça aide.
- examples : 4 exemples (espagnol + français), dont 2 tirés de sa vie si possible.
- pitfall_fr : le piège typique des francophones, en une phrase.
- drill_es : 4 phrases à dire à voix haute pour s'entraîner.
JSON strict : { "title_fr": "...", "rule_fr": "...", "examples": [ { "es": "...", "fr": "..." } ], "pitfall_fr": "...", "drill_es": ["..."] }`)) as GrammarCard;
  setCache(`grammar:${category}:${level}`, r);
  return r;
}

// ---------- Coach corner (for Amine) ----------

export type CoachNote = {
  summary_fr: string;
  wins_fr: string[];
  ideas: { title_fr: string; how_fr: string; phrases_es: string[] }[];
  spanish_hour_fr: string;
  avoid_fr: string;
};

export async function generateCoachNote(): Promise<CoachNote> {
  const p = getProfile();
  const week = db()
    .prepare("SELECT spec, feedback, duration_s FROM sessions WHERE feedback IS NOT NULL AND started_at >= ? ORDER BY started_at DESC")
    .all(new Date(Date.now() - 7 * 86400_000).toISOString()) as { spec: string | null; feedback: string; duration_s: number }[];
  const summaries = week.map((w) => {
    const fb = JSON.parse(w.feedback) as { summary_fr?: string; errors?: { correction: string }[] };
    const title = w.spec ? (JSON.parse(w.spec) as { title: string }).title : "séance";
    return `${title} (${Math.round((w.duration_s ?? 0) / 60)} min) : ${fb.summary_fr ?? ""} Corrections : ${(fb.errors ?? []).map((e) => e.correction).join(" / ")}`;
  });
  const r = (await generateJson(`${learnerBrief()}
Tu es Carla. Écris une note hebdomadaire pour ${p.partner || "son partenaire"}, qui parle très bien espagnol et veut l'aider à pratiquer à la maison, sans jouer au professeur.
Sa semaine :
${summaries.join("\n") || "aucune séance cette semaine"}
- summary_fr : 2 phrases sur sa semaine.
- wins_fr : 2 réussites à féliciter.
- ideas : 3 idées concrètes pour pratiquer ensemble cette semaine (au dîner, en promenade, par message), chacune avec 2-3 phrases espagnoles qu'elle peut utiliser, à son niveau.
- spanish_hour_fr : une proposition d'« heure en espagnol » pour la semaine (moment, durée, règle du jeu).
- avoid_fr : une chose à éviter quand il l'aide (ex. corriger chaque mot).
JSON strict : { "summary_fr": "...", "wins_fr": ["..."], "ideas": [ { "title_fr": "...", "how_fr": "...", "phrases_es": ["..."] } ], "spanish_hour_fr": "...", "avoid_fr": "..." }`)) as CoachNote;
  setCache(`coach:${weekKey()}`, r);
  return r;
}

// ---------- Daily micro-podcast ----------

export type Podcast = {
  title_es: string;
  text_es: string;
  glossary: { es: string; fr: string }[];
  questions: { q_es: string; options: string[]; answer: number }[];
};

export async function generatePodcast(): Promise<Podcast> {
  const { level } = getProfile();
  const words = db().prepare("SELECT word FROM words ORDER BY due_at ASC LIMIT 6").all() as { word: string }[];
  const r = (await generateJson(`${learnerBrief()}
Écris le micro-podcast du jour de Carla : un court récit ou une petite chronique de Madrid, à écouter en 2 minutes.
- Niveau ${level} strict : phrases courtes, vocabulaire fréquent, ${level === "A1" ? "présent surtout" : level === "A2" ? "présent et passé" : "temps variés"}.
- 120 à 200 mots, ton chaleureux, un thème de la vie quotidienne qui la concerne (sa vie, Madrid, son métier, la saison actuelle : ${new Date().toLocaleDateString("fr-FR", { month: "long", timeZone: "Europe/Paris" })}).
- Réutilise naturellement ces mots qu'elle apprend : ${words.map((w) => w.word).join(", ") || "libre"}.
- glossary : 5 mots difficiles du texte (es + fr).
- questions : 3 questions de compréhension en espagnol, 3 options chacune, answer = index de la bonne (0, 1 ou 2).
JSON strict : { "title_es": "...", "text_es": "...", "glossary": [ { "es": "...", "fr": "..." } ], "questions": [ { "q_es": "...", "options": ["...", "...", "..."], "answer": 0 } ] }`)) as Podcast;
  setCache(`podcast:${todayKey()}`, r);
  return r;
}
