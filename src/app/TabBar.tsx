import Link from "next/link";
import { labEnabled } from "@/lib/features";

const TABS = [
  { id: "accueil", href: "/", icon: "🏠", label: "Accueil" },
  { id: "lecons", href: "/lecons", icon: "📚", label: "Leçons" },
  { id: "hasard", href: "/pratique/hasard", icon: "🎲", label: "Au hasard" },
  { id: "progres", href: "/progres", icon: "📈", label: "Progrès" },
  { id: "entretiens", href: "/entretiens", icon: "💼", label: "Entretiens", lab: true },
  { id: "vie-reelle", href: "/vie-reelle", icon: "🌍", label: "Vie réelle", lab: true },
  { id: "profil", href: "/profil", icon: "🙂", label: "Profil" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function TabBar({ active }: { active: TabId | "" }) {
  const tabs = TABS.filter((t) => !("lab" in t) || labEnabled());
  return (
    <nav className="tabbar" aria-label="Navigation" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} className={active === t.id ? "active" : ""} aria-current={active === t.id ? "page" : undefined}>
          <span aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
