import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { rowanMutate, type RowanCommand } from "@/lib/rowan-fns";

export const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export const statuses = {
  all: "All books",
  reading: "Currently reading",
  paused: "Paused",
  want_to_read: "Up next",
  read: "Finished",
  dnf: "Did not finish",
};

export function ReaderPage({ children }: { children: React.ReactNode }) {
  const { sessionId, user, loading } = useAuth();
  if (loading) return <p role="status">Loading your account…</p>;
  if (!sessionId || user?.isGuest)
    return (
      <section className="rounded-2xl border border-border bg-card p-8 space-y-4">
        <h2 className="font-display text-2xl">A home for your reading life</h2>
        <p>Sign in to find books, organize your library, and keep your reading history together.</p>
        <Link
          to="/login"
          className="inline-block rounded-lg bg-primary px-5 py-3 text-primary-foreground"
        >
          Sign in or create an account
        </Link>
      </section>
    );
  return children;
}

export function useReader() {
  const { sessionId } = useAuth();
  const router = useRouter();
  return {
    sessionId: sessionId!,
    openBook: (book: { id: string }) => {
      if (router.state.location.pathname === "/library") {
        try {
          sessionStorage.setItem(`rowan-library:${sessionId}`, router.state.location.href);
        } catch {
          /* Browsing still works without storage. */
        }
      }
      void router.navigate({ href: "/books/" + encodeURIComponent(book.id) });
    },
    goLibrary: () => {
      let href = "/library";
      try {
        const saved = sessionStorage.getItem(`rowan-library:${sessionId}`);
        if (saved === "/library" || saved?.startsWith("/library?")) href = saved;
      } catch {
        /* Fall back to the library. */
      }
      void router.navigate({ href });
    },
  };
}

export function useReadingCommands() {
  const cache = useQueryClient();
  const { sessionId } = useReader();
  const [notice, setNotice] = useState("");
  const retry = useRef<RowanCommand | null>(null);
  const mutation = useMutation({
    mutationFn: (command: RowanCommand) => rowanMutate({ data: { sessionId, command } }),
    onSuccess: async (result) => {
      retry.current = null;
      setNotice(result.ok ? "Saved." : result.message);
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
    onError: () =>
      setNotice("The result could not be confirmed. Retry to safely confirm this change."),
  });
  function run(command: RowanCommand) {
    if (mutation.isPending || retry.current) return;
    retry.current = command;
    setNotice("");
    mutation.mutate(command);
  }
  const feedback = (
    <div role="status" aria-live="polite">
      {notice}
      {mutation.isError && retry.current && (
        <button
          className={control}
          disabled={mutation.isPending}
          onClick={() => retry.current && mutation.mutate(retry.current)}
        >
          Retry change
        </button>
      )}
    </div>
  );
  return { run, busy: mutation.isPending || !!retry.current, feedback };
}
