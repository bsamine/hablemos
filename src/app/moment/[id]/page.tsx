import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { daysUntil, EVENT_KINDS, getEvent, type Pocket } from "@/lib/events";
import { listVoiceNotes } from "@/lib/voice";
import { Say } from "../../feedback/[id]/client";
import GenerateButton from "../../GenerateButton";
import TabBar from "../../TabBar";
import VoiceRecorder from "../../VoiceRecorder";
import VoiceResult from "../../VoiceResult";

export const dynamic = "force-dynamic";

export default async function Moment({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const ev = getEvent(Number((await params).id));
  if (!ev) notFound();
  const kind = EVENT_KINDS.find((k) => k.id === ev.kind);
  const pocket: Pocket | null = ev.pocket ? JSON.parse(ev.pocket) : null;
  const d = daysUntil(ev.date);
  const when = d === 0 ? "aujourd'hui" : d === 1 ? "demain" : d > 1 ? `dans ${d} jours` : `il y a ${-d} jour${d < -1 ? "s" : ""}`;
  const debriefs = listVoiceNotes("debrief", 5, String(ev.id)).filter((n) => n.status === "done");

  return (
    <div className="stack with-tabbar">
      <header className="top">
        <Link href="/vie-reelle" className="link">‹ Vie réelle</Link>
        <span className="muted small">{kind?.icon} {kind?.label}</span>
      </header>
      <div>
        <p className="eyebrow">Moment réel · {when}</p>
        <h1>{ev.title}</h1>
        {ev.details && <p className="muted">{ev.details}</p>}
      </div>

      <ol className="loop">
        <li className={d >= 0 ? "current" : "past"}>
          <p className="eyebrow">1 · Avant — se préparer</p>
          <p>Carla joue la situation deux fois avec toi : avec son aide, puis seule, avec un imprévu.</p>
          <Link href={`/pratique/prep?event=${ev.id}`} className="primary pill">🎙️ Répéter avec Carla (10 min)</Link>
        </li>

        <li className={d >= 0 ? "current" : "past"}>
          <p className="eyebrow">2 · Pendant — ta carte de poche</p>
          {pocket ? (
            <div className="pocket">
              <p className="better"><Say text={pocket.opener_es} /> {pocket.opener_es}</p>
              <ul className="words">
                {pocket.phrases.map((p, i) => (
                  <li key={i}>
                    <Say text={p.es} />
                    <div>
                      <strong>{p.es}</strong>
                      <div className="muted small">{p.fr}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted small">💡 {pocket.tip_fr}</p>
              <GenerateButton url={`/api/events/${ev.id}/pocket`} label="Refaire la carte" variant="secondary" />
            </div>
          ) : (
            <>
              <p className="muted small">5 phrases essentielles et ta première phrase, à relire juste avant.</p>
              <GenerateButton url={`/api/events/${ev.id}/pocket`} label="Préparer ma carte de poche" />
            </>
          )}
        </li>

        <li className={d <= 0 ? "current" : ""}>
          <p className="eyebrow">3 · Après — raconte à Carla</p>
          <p className="muted small">
            Raconte comment ça s'est passé, en espagnol ou en français, et surtout ce que tu n'as pas su dire. Carla en fait tes
            prochains mots. N'enregistre que ta voix, jamais les autres personnes.
          </p>
          <VoiceRecorder kind="debrief" refId={String(ev.id)} label="Raconter (2 min max)" maxSeconds={120} />
          {debriefs.map((n) => (
            <div key={n.id} className="card">
              <VoiceResult kind="debrief" result={JSON.parse(n.result!)} />
            </div>
          ))}
        </li>
      </ol>

      <form action="/api/events" method="post" className="center-small">
        <input type="hidden" name="delete" value={ev.id} />
        <button className="link small" type="submit">Supprimer ce moment</button>
      </form>
      <TabBar active="vie-reelle" />
    </div>
  );
}
