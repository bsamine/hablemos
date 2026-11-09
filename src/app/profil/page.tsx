import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import TabBar from "../TabBar";
import { frDate } from "@/lib/format";
import { VOICES } from "@/lib/gemini";
import { getProfile, LEVELS, listFacts } from "@/lib/profile";
import { VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

const LEVEL_HELP: Record<string, string> = {
  A1: "Débutante : phrases très simples, Carla parle lentement.",
  A2: "Élémentaire : situations du quotidien, passé composé.",
  B1: "Intermédiaire : raconter, expliquer, donner son avis.",
  B2: "Avancée : argumenter, nuancer, parler naturellement.",
};

export default async function Profil({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAuth();
  const { ok } = await searchParams;
  const p = getProfile();
  const facts = listFacts();
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        {ok && <span className="small good-text">Enregistré ✓</span>}
      </header>
      <div className="carla-intro">
        <img src="/carla.svg" alt="" className="avatar" />
        <div>
          <h1>Faisons connaissance</h1>
          <p className="muted">Plus Carla te connaît, plus vos conversations te ressemblent.</p>
        </div>
      </div>

      <form action="/api/profile" method="post" className="card stack">
        <label className="field">
          <span>Ton prénom</span>
          <input name="name" defaultValue={p.name} maxLength={60} placeholder="Comment Carla doit t'appeler" />
        </label>
        <label className="field">
          <span>Parle-lui de toi</span>
          <textarea
            name="about"
            rows={5}
            maxLength={2000}
            defaultValue={p.about}
            placeholder="Ton métier, ta ville, pourquoi tu apprends l'espagnol, ce que tu aimes, tes projets à venir…"
          />
        </label>
        <label className="field">
          <span>Ton niveau</span>
          <select name="level" defaultValue={p.level}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l} — {LEVEL_HELP[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>La voix de Carla</span>
          <select name="voice" defaultValue={p.voice || "Aoede"}>
            {VOICES.map((v) => (
              <option key={v} value={v}>{v}{v === "Aoede" ? " (par défaut)" : ""}</option>
            ))}
          </select>
        </label>
        <button className="primary" type="submit">Enregistrer</button>
      </form>

      <section className="stack" id="memoire">
        <h3>Ce que Carla a retenu</h3>
        <p className="muted small">
          Après chaque séance, Carla note ce que tu lui racontes pour en reparler. Tu peux corriger ou effacer.
        </p>
        <ul className="list">
          {facts.map((f) => (
            <li key={f.id} className="card fact">
              <span className="grow">
                {f.text}
                <span className="muted small">{frDate(f.created_at)}</span>
              </span>
              <form action="/api/profile/facts" method="post">
                <input type="hidden" name="delete" value={f.id} />
                <button className="link small" type="submit" aria-label="Effacer">Effacer</button>
              </form>
            </li>
          ))}
          {!facts.length && <li className="muted small">Rien pour l'instant : parle-lui de toi pendant les séances !</li>}
        </ul>
        <form action="/api/profile/facts" method="post" className="row">
          <input name="text" maxLength={200} placeholder="Ajouter quelque chose à retenir" />
          <button className="secondary" type="submit">Ajouter</button>
        </form>
      </section>
      <p className="muted small center-small">Hablemos con Carla · v{VERSION}</p>
      <TabBar active={""} />
    </div>
  );
}
