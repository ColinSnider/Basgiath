import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import appCss from "../../../src/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Rowan — A reader’s companion" },
      { name: "description", content: "Your books, reading history, margins, and goals." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
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
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}
