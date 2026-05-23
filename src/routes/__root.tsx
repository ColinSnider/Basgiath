import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  useLocation,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { StoreProvider, useStore } from "@/lib/basgiath-store";
import { shouldRequireLoginRedirect } from "@/lib/session-auth.js";
import {
  PRESET_THEMES,
  FONT_CHOICES,
  DISPLAY_FONT_CHOICES,
  normalizeUserPreferences,
} from "@/lib/user-preferences";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#5a1a25" },
      { title: "Basgiath — A reader's companion" },
      {
        name: "description",
        content: "Track your reading history, bookmarks, margins, and goals.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lora:wght@400;500;600&family=Merriweather:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AppShell() {
  const { settings, preferences } = useStore();
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !!settings.darkMode);
  }, [settings.darkMode]);

  // Apply font scale
  useEffect(() => {
    const scale = settings.fontScale ?? "md";
    document.documentElement.style.fontSize =
      scale === "sm" ? "14px" : scale === "lg" ? "18px" : "16px";
  }, [settings.fontScale]);

  useEffect(() => {
    const root = document.documentElement;
    const prefs = normalizeUserPreferences(preferences);
    if (!prefs.useCustomFont) {
      root.style.removeProperty("--font-sans");
      root.style.removeProperty("--font-display");
      return;
    }
    const bodyFont =
      FONT_CHOICES.find((f) => f.id === prefs.bodyFont)?.cssVar ??
      FONT_CHOICES.find((f) => f.id === "inter")?.cssVar;
    const displayFont =
      DISPLAY_FONT_CHOICES.find((f) => f.id === prefs.displayFont)?.cssVar ??
      DISPLAY_FONT_CHOICES.find((f) => f.id === "playfair")?.cssVar;
    if (bodyFont) root.style.setProperty("--font-sans", bodyFont);
    if (displayFont) root.style.setProperty("--font-display", displayFont);
  }, [preferences]);

  // Apply accent color as CSS variables on :root
  useEffect(() => {
    const root = document.documentElement;

    const prefs = normalizeUserPreferences(preferences);
    const customTheme = prefs.activeCustomThemeId
      ? prefs.customThemes.find((t) => t.id === prefs.activeCustomThemeId)
      : null;
    const fallbackTheme = PRESET_THEMES.find((t) => t.id === settings.accentColor) ?? PRESET_THEMES[0];
    const theme = customTheme
      ? {
          light: [customTheme.lightPrimary, customTheme.lightForeground] as [string, string],
          dark: [customTheme.darkPrimary, customTheme.darkForeground] as [string, string],
          darkSurfaces: fallbackTheme.darkSurfaces,
        }
      : fallbackTheme;
    const isDark = settings.darkMode;
    const [primary, primaryFg] = isDark ? theme.dark : theme.light;

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", primaryFg);
    root.style.setProperty("--ring", primary);

    if (isDark) {
      const s = theme.darkSurfaces;
      root.style.setProperty("--background", s.bg);
      root.style.setProperty("--card", s.card);
      root.style.setProperty("--popover", s.card);
      root.style.setProperty("--border", s.border);
      root.style.setProperty("--input", s.border);
      root.style.setProperty("--muted", s.muted);
      root.style.setProperty("--secondary", s.muted);
      root.style.setProperty("--accent", s.muted);
    } else {
      for (const v of [
        "--background",
        "--card",
        "--popover",
        "--border",
        "--input",
        "--muted",
        "--secondary",
        "--accent",
      ]) {
        root.style.removeProperty(v);
      }
    }
  }, [settings.accentColor, settings.darkMode, preferences]);

  // Redirect to login if not authenticated (after loading)
  // Exception: "/" shows the landing page, so no redirect needed there
  useEffect(() => {
    if (shouldRequireLoginRedirect({ loading, user, pathname })) {
      navigate({ to: "/login" });
    }
  }, [loading, user, pathname, navigate]);

  const hideNav =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname === "/login" ||
    (pathname === "/" && !user);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-2xl text-primary">Basgiath</p>
          <p className="text-xs text-muted-foreground mt-2">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto pb-24 md:pb-10">
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

function InnerApp() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}
