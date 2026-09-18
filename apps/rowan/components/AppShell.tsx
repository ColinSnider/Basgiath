import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Home,
  Library,
  Menu,
  Search,
  UserRound,
  Target,
  NotebookPen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRowanTheme } from "@/components/rowan/useRowanTheme";
import { Welcome } from "./Welcome";
import { AccountMenu } from "./AccountMenu";

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
] as const;
const moreItems = [
  { to: "/goals", label: "Goals", description: "Set targets and keep momentum." },
  { to: "/margins", label: "Margins", description: "Keep the lines that stayed with you." },
] as const;
const historyItems = [
  { to: "/insights", label: "Insights", description: "See your patterns and momentum." },
] as const;
const accountPage = {
  to: "/account",
  label: "Settings",
  description: "Appearance, sign-in security, and your library backups.",
};

function Theme({ sessionId }: { sessionId: string }) {
  useRowanTheme(sessionId);
  return null;
}

export function AppShell() {
  const { pathname } = useLocation();
  const { user, sessionId, loading } = useAuth();
  if (pathname === "/login") return <Outlet />;
  if (pathname === "/" && !user) {
    if (loading) return <main className="reader-welcome" aria-busy="true">Loading Rowan…</main>;
    return <Welcome initialRegistering />;
  }

  const page =
    primary.find((item) => item.to === pathname) ??
    moreItems.find((item) => item.to === pathname) ??
    historyItems.find((item) => item.to === pathname) ??
    (pathname === "/profile"
      ? { label: "Profile", description: "A little about you and your reading life." }
      : pathname === accountPage.to
        ? accountPage
        : undefined);
  const active = (to: string) =>
    pathname === to ||
    (to === "/library" && pathname.startsWith("/books/")) ||
    (to === "/calendar" && pathname === "/insights");
  const moreActive = moreItems.some((item) => item.to === pathname);

  const MoreButton = ({ mobile = false }: { mobile?: boolean }) => (
    <Link
      to="/goals"
      className={
        mobile
          ? "reader-mobile-more-button"
          : `reader-more-button ${moreActive ? "is-current" : ""}`
      }
      aria-current={moreActive ? "page" : undefined}
    >
      <Menu size={mobile ? 20 : 19} />
      <span>More</span>
    </Link>
  );

  return (
    <div className="reader-app">
      {sessionId && !user?.isGuest && <Theme sessionId={sessionId} />}
      <a className="reader-skip" href="#page-content">
        Skip to content
      </a>
      <aside className="reader-sidebar">
        <Link to="/" className="reader-brand">
          <img className="reader-brand-mark" src="/rowan-mark.png" alt="" />
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
          <MoreButton />
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
            <img className="reader-wordmark-mark" src="/rowan-mark.png" alt="" />
            <span>Rowan</span>
          </Link>
          <div className="reader-topbar-actions">
            {user && !user.isGuest ? <AccountMenu /> : <Link to="/login">Sign in</Link>}
          </div>
        </header>
        <main id="page-content" className="reader-page" data-home={pathname === "/"} tabIndex={-1}>
          <header className={pathname === "/" ? "sr-only" : "reader-page-heading"}>
            <h1>
              {page?.label ?? (pathname.startsWith("/books/") ? "Book details" : "Page not found")}
            </h1>
            {page && "description" in page && <p>{page.description}</p>}
          </header>
          {moreActive && (
            <nav
              className="reader-more-switch reader-view-slider"
              style={
                {
                  "--view-index": pathname === "/margins" ? 1 : 0,
                  "--view-count": 2,
                } as React.CSSProperties
              }
              aria-label="More navigation"
            >
              {moreItems.map(({ to, label }) => (
                <Link key={to} to={to} aria-current={pathname === to ? "page" : undefined}>
                  {to === "/goals" ? (
                    <Target size={17} aria-hidden="true" />
                  ) : (
                    <NotebookPen size={17} aria-hidden="true" />
                  )}
                  {label}
                </Link>
              ))}
            </nav>
          )}
          <div className="space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
      <nav className="reader-mobile-nav" aria-label="Mobile navigation">
        {primary.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} aria-current={active(to) ? "page" : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <MoreButton mobile />
      </nav>
    </div>
  );
}
