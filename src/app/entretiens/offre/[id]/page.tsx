import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import type { InterviewPack } from "@/lib/generate";
import { getJobAd } from "@/lib/jobs";
import { Say } from "../../../feedback/[id]/client";
import GenerateButton from "../../../GenerateButton";
import TabBar from "../../../TabBar";

export const dynamic = "force-dynamic";

export default async function Offre({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const ad = getJobAd(Number((await params).id));
  if (!ad) notFound();
  const pack: InterviewPack | null = ad.pack ? JSON.parse(ad.pack) : null;
  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/entretiens" className="link">‹ Entretiens</Link>
      </header>
      <div>
        <p className="eyebrow">Dossier d'entretien</p>
        <h1>{ad.title}</h1>
        {ad.company && <p className="muted">{ad.company}</p>}
      </div>
      <div className="row">
        <Link href={`/pratique/entretien?offre=${ad.id}`} className="primary">🎙️ Simulation avec Carla</Link>
      </div>

      {!pack ? (
        <section className="card stack">
          <p>
            Carla analyse l'offre et prépare : ce que cherche le recruteur, les 10 questions probables avec une réponse modèle à
            ton niveau, une antisèche et les questions à poser.
          </p>
          <GenerateButton url={`/api/offres/${ad.id}/pack`} label="Préparer mon dossier" busyLabel="Carla lit l'offre…" />
        </section>
      ) : (
        <>
          <section className="card">
            <p className="eyebrow">Ce que le recruteur cherche</p>
            <p>{pack.summary_fr}</p>
          </section>
          <section className="card">
            <p className="eyebrow">À vérifier avant l'entretien</p>
            <ul className="checklist">{pack.research_fr.map((r, i) => <li key={i}>☐ {r}</li>)}</ul>
          </section>
          <section className="stack">
            <h3>Les 10 questions probables</h3>
            {pack.questions.map((q, i) => (
              <details key={i} className="card qa">
                <summary>
                  <Say text={q.q_es} /> {q.q_es}
                </summary>
                <p className="muted small">{q.why_fr}</p>
                <p className="better"><Say text={q.model_answer_es} /> {q.model_answer_es}</p>
              </details>
            ))}
          </section>
          <section className="card">
            <p className="eyebrow">Antisèche</p>
            <ul className="words">
              {pack.cheat_sheet.map((c, i) => (
                <li key={i}>
                  <Say text={c.es} />
                  <div><strong>{c.es}</strong><div className="muted small">{c.fr}</div></div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <p className="eyebrow">Questions à poser au recruteur</p>
            <ul className="words">
              {pack.ask_them_es.map((q, i) => (
                <li key={i}><Say text={q} /> <span>{q}</span></li>
              ))}
            </ul>
          </section>
          <GenerateButton url={`/api/offres/${ad.id}/pack`} label="Refaire le dossier" variant="secondary" />
        </>
      )}
      <TabBar active="entretiens" />
    </div>
  );
}
