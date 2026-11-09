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
  target: string;
  score: number;
  words: { word: string; heard: string; ok: boolean; tip_fr: string }[];
  phonetic_fr: string;
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
  // Step 1 — blind transcription: the model must not know the target, or it "hears" the correct sentence.
  const heard = (await analyseAudio(
    `Transcris EXACTEMENT ce que dit cette personne en espagnol, son par son, telle qu'elle le prononce.
- N'autocorrige rien : si un mot est mal prononcé, écris ce que tu entends vraiment (même si ce n'est pas un vrai mot, ex. « la cuenta » prononcé « la couenta » → « la kuenta »).
- N'ajoute pas de ponctuation inventée. Si tu n'entends rien d'intelligible, renvoie une chaîne vide.
JSON strict : { "transcript": "..." }`,
    audio,
  )) as { transcript: string };

  // Step 2 — compare with the target, listening to the audio again.
  const r = (await analyseAudio(
    `${learner()}
Elle devait lire à voix haute : « ${target} ».
Une transcription faite sans connaître la phrase cible a entendu : « ${heard.transcript ?? ""} ».
Écoute à nouveau l'enregistrement et compare, mot par mot, avec la phrase cible (accent d'Espagne attendu ; un accent français léger est acceptable s'il reste clair).
- words : CHAQUE mot de la phrase cible, dans l'ordre : word = le mot cible, heard = ce qui a été entendu pour ce mot (vide s'il manque), ok = true seulement s'il est clairement bien prononcé, tip_fr = si ok est false, un conseil concret pour une francophone (ex. « le j se dit comme un r raclé du fond de la gorge », « appuie sur la syllabe CUEN »).
- score : de 1 (incompréhensible) à 5 (clair et naturel). Sois exigeante mais juste : si des mots manquent ou sont déformés, le score ne peut pas dépasser 3.
- phonetic_fr : la phrase cible écrite « à la française » pour l'aider à la prononcer, avec la syllabe accentuée en MAJUSCULES (ex. « la KOUEN-ta, por fa-BOR »).
- tip_fr : le conseil le plus utile, en une phrase.
JSON strict : { "score": 1, "words": [ { "word": "...", "heard": "...", "ok": true, "tip_fr": "" } ], "phonetic_fr": "...", "tip_fr": "..." }`,
    audio,
  )) as Omit<PronunciationResult, "transcript" | "target">;
  return { ...r, transcript: heard.transcript ?? "", target };
}
