import { Link, useLocation } from "@tanstack/react-router";
import { BookMarked, Home, NotebookPen, Target } from "lucide-react";

type NavItem = { to: string; label: string; Icon: typeof Home; exact?: boolean };

const items: NavItem[] = [
  { to: "/", label: "Home", Icon: Home, exact: true },
  { to: "/library", label: "Library", Icon: BookMarked },
  { to: "/margins", label: "Margins", Icon: NotebookPen },
  { to: "/goals", label: "Goals", Icon: Target },
];

export function DesktopSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden md:flex md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:border-r md:border-border md:bg-card/60 md:backdrop-blur">
      <div className="px-6 pt-8 pb-6 border-b border-border/80">
        <p className="font-display text-3xl text-primary leading-none">Basgiath</p>
        <p className="mt-2 text-xs text-muted-foreground">Your reading companion</p>
      </div>

      <nav className="px-3 py-5 space-y-1">
        {items.map(({ to, label, Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to as "/"}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
