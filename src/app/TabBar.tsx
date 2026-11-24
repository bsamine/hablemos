import Link from "next/link";
import { labEnabled } from "@/lib/features";

const TABS = [
  { id: "accueil", href: "/", icon: "🏠", label: "Accueil" },
  { id: "lecons", href: "/lecons", icon: "📚", label: "Leçons" },
  { id: "progres", href: "/progres", icon: "📈", label: "Progrès" },
  { id: "entretiens", href: "/entretiens", icon: "💼", label: "Entretiens", lab: true },
  { id: "vie-reelle", href: "/vie-reelle", icon: "🌍", label: "Vie réelle", lab: true },
] as const;

export default function TabBar({ active }: { active: (typeof TABS)[number]["id"] | "" }) {
  return (
    <nav className="tabbar" aria-label="Navigation">
      {TABS.filter((t) => !("lab" in t) || labEnabled()).map((t) => (
        <Link key={t.id} href={t.href} className={active === t.id ? "active" : ""}>
          <span aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
