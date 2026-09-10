import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Home, Library, Search, CalendarDays, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRowanTheme } from "@/components/rowan/useRowanTheme";

const primary = [
  { to: "/", label: "Home", icon: Home, description: "Your reading life, one book at a time." },
  {
    to: "/library",
    label: "Library",
    icon: Library,
    description: "Your books, shelves, and reading lists.",
  },
  {
    to: "/search",
    label: "Search",
    icon: Search,
    description: "Find your next book. Make it part of your story.",
  },
  {
    to: "/calendar",
    label: "History",
    icon: CalendarDays,
    description: "Every session and every finished chapter.",
  },
  {
    to: "/account",
    label: "Account",
    icon: UserRound,
    description: "Your preferences, backups, and account controls.",
  },
] as const;
const secondary = [
  { to: "/insights", label: "Insights" },
  { to: "/goals", label: "Goals" },
  { to: "/margins", label: "Margins" },
] as const;

function Theme({ sessionId }: { sessionId: string }) {
  useRowanTheme(sessionId);
  return null;
}

export function AppShell() {
  const { pathname } = useLocation();
  const { user, sessionId, logout } = useAuth();
  const cache = useQueryClient();
  if (pathname === "/login") return <Outlet />;
  const page =
    primary.find((item) => item.to === pathname) ?? secondary.find((item) => item.to === pathname);
  const active = (to: string) =>
    pathname === to || (to === "/library" && pathname.startsWith("/books/"));
  return (
    <div className="reader-app">
      {sessionId && !user?.isGuest && <Theme sessionId={sessionId} />}
      <a className="reader-skip" href="#page-content">
        Skip to content
      </a>
      <aside className="reader-sidebar">
        <Link to="/" className="reader-brand">
          <BookOpen size={28} />
          <span>Rowan</span>
        </Link>
        <p className="reader-caption">A reader’s companion</p>
        <nav aria-label="Main navigation">
          {primary.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              aria-current={active(to) ? "page" : undefined}
              className={active(to) ? "is-current" : ""}
            >
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Reading tools" className="reader-tools">
          {secondary.map(({ to, label }) => (
            <Link key={to} to={to} aria-current={active(to) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <p className="reader-sidebar-note">
          Keep the books.
          <br />
          Keep the memories.
        </p>
      </aside>
      <div className="reader-main">
        <header className="reader-topbar">
          <Link to="/" className="reader-wordmark">
            Rowan
          </Link>
          {user && !user.isGuest ? (
            <div className="flex items-center gap-4">
              <Link to="/account">{user.displayName || user.username}</Link>
              <button
                onClick={async () => {
                  await logout();
                  cache.clear();
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </header>
        <main id="page-content" className="reader-page" tabIndex={-1}>
          <header className="reader-page-heading">
            <p className="reader-caption">Your reading companion</p>
            <h1>
              {page?.label ?? (pathname.startsWith("/books/") ? "Book details" : "Page not found")}
            </h1>
            {page && "description" in page && <p>{page.description}</p>}
          </header>
          <div className="space-y-6">
            <Outlet />
          </div>
        </main>
        <nav className="reader-mobile-tools" aria-label="Reading tools">
          {secondary.map(({ to, label }) => (
            <Link key={to} to={to} aria-current={active(to) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <nav className="reader-mobile-nav" aria-label="Mobile navigation">
        {primary.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} aria-current={active(to) ? "page" : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
