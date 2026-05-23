import { Link, useLocation } from "@tanstack/react-router";
import { Home, BookMarked, NotebookPen, Target } from "lucide-react";

type Tab = { to: string; label: string; Icon: typeof Home; exact?: boolean };
const tabs: Tab[] = [
  { to: "/", label: "Home", Icon: Home, exact: true },
  { to: "/library", label: "Library", Icon: BookMarked },
  { to: "/margins", label: "Margins", Icon: NotebookPen },
  { to: "/goals", label: "Goals", Icon: Target },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed md:static bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4 max-w-5xl mx-auto">
        {tabs.map(({ to, label, Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to as "/"}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.25]" : ""}`} />
                <span className="font-medium tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
