import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, ChevronRight, Home, Library, Menu, Search, UserRound, X } from "lucide-react";
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
  label: "Account",
  description: "Your preferences, backups, and account controls.",
};

function Theme({ sessionId }: { sessionId: string }) {
  useRowanTheme(sessionId);
  return null;
}

export function AppShell() {
  const { pathname } = useLocation();
  const { user, sessionId, logout } = useAuth();
  const cache = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [moreOpen]);
  if (pathname === "/login") return <Outlet />;

  const page =
    primary.find((item) => item.to === pathname) ??
    moreItems.find((item) => item.to === pathname) ??
    historyItems.find((item) => item.to === pathname) ??
    (pathname === accountPage.to ? accountPage : undefined);
  const active = (to: string) =>
    pathname === to ||
    (to === "/library" && pathname.startsWith("/books/")) ||
    (to === "/calendar" && pathname === "/insights");
  const moreActive = moreItems.some((item) => item.to === pathname);

  const MoreButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      type="button"
      className={mobile ? "reader-mobile-more-button" : "reader-more-button"}
      aria-expanded={moreOpen}
      aria-haspopup="menu"
      aria-current={moreActive ? "page" : undefined}
      onClick={() => setMoreOpen((open) => !open)}
    >
      {moreOpen ? <X size={mobile ? 20 : 19} /> : <Menu size={mobile ? 20 : 19} />}
      <span>More</span>
    </button>
  );

  const MoreMenu = () => (
    <div className="reader-more-menu" role="menu" aria-label="More reading tools">
      <p className="reader-more-menu-label">Reading tools</p>
      {moreItems.map(({ to, label, description }) => (
        <Link
          key={to}
          to={to}
          role="menuitem"
          aria-current={active(to) ? "page" : undefined}
          onClick={() => setMoreOpen(false)}
        >
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
          <ChevronRight size={16} />
        </Link>
      ))}
    </div>
  );

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
          <MoreButton />
        </nav>
        {moreOpen && <MoreMenu />}
        <Link
          to="/account"
          className={`reader-sidebar-account ${active("/account") ? "is-current" : ""}`}
          aria-current={active("/account") ? "page" : undefined}
        >
          <UserRound size={19} />
          <span>Account</span>
        </Link>
        <p className="reader-sidebar-note">
          Keep the books.
          <br />
          Keep the memories.
        </p>
      </aside>
      <div className="reader-main">
        <header className="reader-topbar">
          <Link to="/" className="reader-wordmark">
            <BookOpen size={19} />
            <span>Rowan</span>
          </Link>
          <div className="reader-topbar-actions">
            <div className="reader-topbar-more">
              <MoreButton mobile />
              {moreOpen && <MoreMenu />}
            </div>
            {user && !user.isGuest ? (
              <>
                <Link className="reader-mobile-account" to="/account" aria-label="Open account">
                  <UserRound size={20} />
                  <span>Account</span>
                </Link>
                <button className="reader-signout" onClick={async () => { await logout(); cache.clear(); }}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login">Sign in</Link>
            )}
          </div>
        </header>
        {(pathname === "/calendar" || pathname === "/insights") && (
          <nav className="reader-context-nav" aria-label="History navigation">
            <span>History</span>
            <Link to="/calendar" aria-current={pathname === "/calendar" ? "page" : undefined}>Calendar</Link>
            <Link to="/insights" aria-current={pathname === "/insights" ? "page" : undefined}>Insights</Link>
          </nav>
        )}
        <main id="page-content" className="reader-page" tabIndex={-1}>
          <header className={pathname === "/" ? "sr-only" : "reader-page-heading"}>
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
