import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { history } from "@/lib/history";
import HistoryList from "../HistoryList";

export const dynamic = "force-dynamic";

export default async function Historique() {
  await requireAuth();
  const items = history();
  return (
    <div className="stack">
      <header className="top">
        <Link href="/" className="link">‹ Accueil</Link>
        <span className="muted small">{items.length} séances</span>
      </header>
      <h1>Mes bilans</h1>
      <p className="muted">Relis tes corrections et réécoute les bonnes phrases avant ta prochaine séance.</p>
      <HistoryList items={items} />
    </div>
  );
}
