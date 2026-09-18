import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import shellCss from "../shell.css?url";
import { AuthProvider } from "@/lib/auth-context";
import appCss from "../../../src/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Rowan — A reader’s companion" },
      { name: "description", content: "Your books, reading history, margins, and goals." },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Rowan" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: shellCss },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/rowan-favicon-v2.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/rowan-apple-touch-v2.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  component: Root,
  notFoundComponent: () => (
    <main className="p-8">
      <h1>Page not found</h1>
      <a href="/">Return to Rowan</a>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="p-8">
      <h1>Rowan could not load this page</h1>
      <button onClick={reset}>Try again</button>
    </main>
  ),
});

function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider sessionKey="rowan:session">
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}
