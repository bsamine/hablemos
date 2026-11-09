import { db } from "./db";
import { getEvent } from "./events";
import { upsertWord } from "./learning";
import { addFacts, getProfile, listFacts } from "./profile";
import { analyseAudio, type VoiceNote } from "./voice";

type Audio = { data: string; mimeType: string };

export type MissingResult = {
  transcript: string;
  items: { intent_fr: string; es: string; explanation_fr: string; example_es: string }[];
  encouragement_fr: string;
};
export type DebriefResult = {
  transcript: string;
  summary_fr: string;
  went_well_fr: string[];
  missing: { intent_fr: string; es: string }[];
  facts: string[];
  next_step_fr: string;
};
export type DiaryResult = {
  transcript: string;
  reply_es: string;
  corrections: { said: string; better: string; why_fr: string }[];
  question_es: string;
  facts: string[];
};
export type PronunciationResult = {
  transcript: string;
  score: number;
  words: { word: string; ok: boolean; tip_fr: string }[];
  tip_fr: string;
};

const learner = () => {
  const p = getProfile();
  return `Apprenante : ${p.name || "l'élève"}, francophone, niveau ${p.level} en espagnol (espagnol d'Espagne). Ce qu'on sait d'elle : ${
    listFacts()
      .slice(0, 15)
      .map((f) => f.text)
      .join(" ; ") || "peu de choses"
  }.`;
};

export async function analyseNote(note: VoiceNote, audio: Audio): Promise<unknown> {
  switch (note.kind) {
    case "missing":
      return missing(audio, note.id);
    case "debrief":
      return debrief(audio, Number(note.ref), note.id);
    case "diary":
      return diary(audio, note.id);
    case "pronunciation":
      return pronunciation(audio, note.ref);
  }
}

async function missing(audio: Audio, noteId: number): Promise<MissingResult> {
  const r = (await analyseAudio(
    `${learner()}
Dans cet enregistrement, elle explique (en français, en espagnol approximatif ou en mélangeant) ce qu'elle voulait dire en espagnol dans une vraie conversation, sans y arriver.
1. Transcris fidèlement.
2. Pour chaque idée qu'elle voulait exprimer (maximum 5), donne la formulation espagnole naturelle, adaptée à son niveau, une explication courte en français (15 mots max) et un exemple.
3. Une phrase d'encouragement en français.
JSON strict : { "transcript": "...", "items": [ { "intent_fr": "...", "es": "...", "explanation_fr": "...", "example_es": "..." } ], "encouragement_fr": "..." }`,
    audio,
  )) as MissingResult;
  for (const it of r.items ?? []) if (it.es) upsertWord(it.es.slice(0, 120), it.intent_fr ?? "", it.example_es ?? "");
  void noteId;
  return r;
}

async function debrief(audio: Audio, eventId: number, noteId: number): Promise<DebriefResult> {
  const ev = getEvent(eventId);
  const r = (await analyseAudio(
    `${learner()}
Elle raconte comment s'est passé un moment réel${ev ? ` : « ${ev.title} » (${ev.date})${ev.details ? `, contexte : ${ev.details}` : ""}` : ""}. Elle peut parler en espagnol ou en français.
1. Transcris fidèlement.
2. Résume en 2 phrases en français, avec bienveillance.
3. Ce qui s'est bien passé (2-3 points, en français).
4. Ce qu'elle n'a pas réussi à dire : pour chaque idée (max 5), la formulation espagnole naturelle à son niveau.
5. facts : faits durables et non sensibles sur sa vie qu'elle mentionne (max 3).
6. Une prochaine étape concrète en français.
JSON strict : { "transcript": "...", "summary_fr": "...", "went_well_fr": ["..."], "missing": [ { "intent_fr": "...", "es": "..." } ], "facts": ["..."], "next_step_fr": "..." }`,
    audio,
  )) as DebriefResult;
  for (const m of r.missing ?? []) if (m.es) upsertWord(m.es.slice(0, 120), m.intent_fr ?? "", "");
  if (Array.isArray(r.facts)) addFacts(r.facts, null);
  if (ev) db().prepare("UPDATE events SET status = 'done' WHERE id = ?").run(ev.id);
  void noteId;
  return r;
}

async function diary(audio: Audio, noteId: number): Promise<DiaryResult> {
  const r = (await analyseAudio(
    `${learner()}
C'est son journal vocal du jour, en espagnol (« ¿Qué tal tu día? »). Tu es Carla, sa professeure.
1. Transcris fidèlement.
2. reply_es : réponds-lui comme une amie, en espagnol simple à son niveau (2-3 phrases), en réagissant à ce qu'elle raconte.
3. corrections : les 2 erreurs les plus utiles à corriger (sa phrase, la bonne, pourquoi en français en 12 mots max). Liste vide si tout est correct.
4. question_es : une question de suivi pour demain.
5. facts : faits durables et non sensibles sur sa vie (max 3).
JSON strict : { "transcript": "...", "reply_es": "...", "corrections": [ { "said": "...", "better": "...", "why_fr": "..." } ], "question_es": "...", "facts": ["..."] }`,
    audio,
  )) as DiaryResult;
  if (Array.isArray(r.facts)) addFacts(r.facts, null);
  void noteId;
  return r;
}

async function pronunciation(audio: Audio, target: string): Promise<PronunciationResult> {
  return (await analyseAudio(
    `${learner()}
Elle lit cette phrase à voix haute : « ${target} ».
Écoute sa prononciation (accent d'Espagne attendu, mais sois tolérante sur l'accent français tant que c'est compréhensible).
1. Transcris ce qu'elle a réellement dit.
2. score : de 1 (incompréhensible) à 5 (très clair et naturel).
3. words : chaque mot de la phrase cible, ok = true s'il est bien prononcé ; sinon un conseil court en français (ex. « le j se prononce comme un r raclé »).
4. tip_fr : le conseil le plus utile, en une phrase.
JSON strict : { "transcript": "...", "score": 1, "words": [ { "word": "...", "ok": true, "tip_fr": "" } ], "tip_fr": "..." }`,
    audio,
  )) as PronunciationResult;
}
