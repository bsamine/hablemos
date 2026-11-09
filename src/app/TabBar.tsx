import Link from "next/link";

const TABS = [
  { id: "accueil", href: "/", icon: "🏠", label: "Accueil" },
  { id: "lecons", href: "/lecons", icon: "📚", label: "Leçons" },
  { id: "entretiens", href: "/entretiens", icon: "💼", label: "Entretiens" },
  { id: "vie-reelle", href: "/vie-reelle", icon: "🌍", label: "Vie réelle" },
] as const;

export default function TabBar({ active }: { active: (typeof TABS)[number]["id"] | "" }) {
  return (
    <nav className="tabbar" aria-label="Navigation">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} className={active === t.id ? "active" : ""}>
          <span aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
