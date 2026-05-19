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
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600&display=swap",
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
  const { settings } = useStore();
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

  // Apply accent color as CSS variables on :root
  useEffect(() => {
    const root = document.documentElement;

    type ThemeEntry = {
      light: [string, string];
      dark: [string, string];
      darkSurfaces: { bg: string; card: string; border: string; muted: string };
    };

    const THEMES: Record<string, ThemeEntry> = {
      default: {
        light: ["oklch(0.34 0.11 18)", "oklch(0.97 0.012 80)"],
        dark: ["oklch(0.5 0.14 20)", "oklch(0.98 0.01 80)"],
        darkSurfaces: {
          bg: "oklch(0.16 0.02 20)",
          card: "oklch(0.20 0.03 20)",
          border: "oklch(0.30 0.03 20)",
          muted: "oklch(0.26 0.04 20)",
        },
      },
      sage: {
        light: ["oklch(0.35 0.07 155)", "oklch(0.97 0.01 130)"],
        dark: ["oklch(0.52 0.09 155)", "oklch(0.98 0.01 130)"],
        darkSurfaces: {
          bg: "oklch(0.15 0.018 155)",
          card: "oklch(0.19 0.022 155)",
          border: "oklch(0.28 0.026 155)",
          muted: "oklch(0.24 0.030 155)",
        },
      },
      ocean: {
        light: ["oklch(0.33 0.09 245)", "oklch(0.97 0.01 245)"],
        dark: ["oklch(0.5 0.12 245)", "oklch(0.98 0.01 245)"],
        darkSurfaces: {
          bg: "oklch(0.15 0.018 245)",
          card: "oklch(0.19 0.022 245)",
          border: "oklch(0.28 0.026 245)",
          muted: "oklch(0.24 0.030 245)",
        },
      },
      sunset: {
        light: ["oklch(0.42 0.12 40)", "oklch(0.97 0.012 60)"],
        dark: ["oklch(0.58 0.14 40)", "oklch(0.98 0.01 60)"],
        darkSurfaces: {
          bg: "oklch(0.15 0.018 40)",
          card: "oklch(0.19 0.022 40)",
          border: "oklch(0.28 0.026 40)",
          muted: "oklch(0.24 0.030 40)",
        },
      },
      slate: {
        light: ["oklch(0.35 0.025 255)", "oklch(0.97 0.005 255)"],
        dark: ["oklch(0.52 0.03 255)", "oklch(0.98 0.005 255)"],
        darkSurfaces: {
          bg: "oklch(0.15 0.012 255)",
          card: "oklch(0.19 0.015 255)",
          border: "oklch(0.28 0.018 255)",
          muted: "oklch(0.24 0.020 255)",
        },
      },
      violet: {
        light: ["oklch(0.33 0.16 295)", "oklch(0.97 0.01 295)"],
        dark: ["oklch(0.52 0.18 295)", "oklch(0.98 0.01 295)"],
        darkSurfaces: {
          bg: "oklch(0.15 0.022 295)",
          card: "oklch(0.19 0.028 295)",
          border: "oklch(0.28 0.032 295)",
          muted: "oklch(0.24 0.036 295)",
        },
      },
    };

    const theme = THEMES[settings.accentColor] ?? THEMES.default;
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
  }, [settings.accentColor, settings.darkMode]);

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
      <div className="max-w-md mx-auto pb-24">
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
