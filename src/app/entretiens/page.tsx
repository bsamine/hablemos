import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { frDate } from "@/lib/format";
import { history } from "@/lib/history";
import { listJobAds } from "@/lib/jobs";
import { doneScenarioIds } from "@/lib/learning";
import { INTERVIEW_LESSONS } from "@/lib/scenarios";
import HistoryList from "../HistoryList";
import TabBar from "../TabBar";

export const dynamic = "force-dynamic";

export default async function Entretiens({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requireAuth();
  const { e } = await searchParams;
  const ads = listJobAds();
  const done = doneScenarioIds();
  const past = history({ modes: ["interview", "dele"], limit: 10 });
  const scored = past.filter((p) => p.interviewScore !== null);
  const avg = scored.length ? Math.round((scored.reduce((a, p) => a + (p.interviewScore ?? 0), 0) / scored.length) * 10) / 10 : null;

  return (
    <div className="stack with-tabbar">
      <header className="area-header">
        <span className="area-icon">💼</span>
        <div>
          <h1>Entretiens</h1>
          <p className="muted small">Préparer de vrais entretiens en espagnol</p>
        </div>
      </header>

      {avg !== null && (
        <section className="stats">
          <div><strong>{past.length}</strong><span>simulation{past.length > 1 ? "s" : ""}</span></div>
          <div><strong>{avg}/5</strong><span>note moyenne</span></div>
          <div><strong>{scored[0]?.interviewScore ?? "–"}/5</strong><span>dernière note</span></div>
        </section>
      )}

      <section className="card stack" id="offre">
        <div>
          <p className="eyebrow">Simulation sur une vraie offre</p>
          <p className="muted small">
            Colle une offre d'emploi (en espagnol ou en français). Carla joue la recruteuse de l'entreprise et te pose les
            questions de ce poste. À la fin : une note sur 4 critères et une réponse modèle.
          </p>
        </div>
        <form action="/api/offres" method="post" className="stack">
          <div className="row">
            <input name="title" maxLength={120} placeholder="Poste (ex. Visitadora médica)" />
            <input name="company" maxLength={120} placeholder="Entreprise" />
          </div>
          <textarea name="text" rows={6} maxLength={6000} required placeholder="Colle ici le texte de l'offre : missions, profil recherché…" />
          {e && <p className="error small">L'offre est trop courte : colle le texte complet.</p>}
          <button className="primary" type="submit">Préparer l'entretien</button>
        </form>
      </section>

      {ads.length > 0 && (
        <section className="stack">
          <h3>Mes offres</h3>
          <ul className="list">
            {ads.map((a) => (
              <li key={a.id} className="card fact">
                <span className="grow">
                  <strong>{a.title}</strong>
                  <span className="muted small">{a.company ? `${a.company} · ` : ""}ajoutée {frDate(a.created_at)}</span>
                </span>
                <Link className="secondary pill" href={`/entretiens/offre/${a.id}`}>{a.pack ? "Dossier" : "Préparer"}</Link>
                <Link className="primary pill" href={`/pratique/entretien?offre=${a.id}`}>Simuler</Link>
                <form action="/api/offres" method="post">
                  <input type="hidden" name="delete" value={a.id} />
                  <button className="link small" type="submit" aria-label="Supprimer l'offre">✕</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack">
        <p className="eyebrow">🎓 Diplôme : simulacre d'oral du DELE</p>
        <p className="muted small">
          Une épreuve orale d'entraînement inspirée du format du DELE, avec préparation chronométrée et note indicative par
          tâche. Le DELE est le diplôme officiel d'espagnol, utile sur un CV.
        </p>
        <div className="row">
          <Link href="/pratique/dele?niveau=A2" className="secondary">DELE A2</Link>
          <Link href="/pratique/dele?niveau=B1" className="secondary">DELE B1</Link>
        </div>
      </section>

      <section className="stack">
        <h3>Leçons d'entretien</h3>
        <ul className="list">
          {INTERVIEW_LESSONS.map((x) => (
            <li key={x.id}>
              <Link href={`/session/${x.id}`}>
                <span className={`day ${done.has(x.id) ? "done" : ""}`}>{done.has(x.id) ? "✓" : x.level}</span>
                <span className="grow">
                  <strong>{x.title}</strong>
                  <span className="muted small">{x.titleFr}</span>
                </span>
                <span className="muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <>
          <h3>Mes simulations</h3>
          <HistoryList items={past} />
        </>
      )}
      <TabBar active="entretiens" />
    </div>
  );
}
