import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Target, NotebookPen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function Welcome({ initialRegistering = false }: { initialRegistering?: boolean }) {
  const { login, register, user, loading: restoring } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(initialRegistering);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user && !user.isGuest) void navigate({ to: "/" });
  }, [user, navigate]);
  return (
    <main className="reader-welcome">
      <div className="reader-welcome-layout">
      <section className="reader-welcome-story" aria-labelledby="welcome-title">
        <Link to="/" className="reader-welcome-brand"><img src="/rowan-mark.png" alt="" />Rowan</Link>
        <div>
          <p className="reader-welcome-eyebrow">A reader’s companion</p>
          <h1 id="welcome-title">Keep the books.<br /><em>Keep the memories.</em></h1>
          <p>Your own corner of the reading world. A home for every book, every chapter, and the lines that stay with you.</p>
        </div>
        <div className="reader-welcome-features">
          <div><BookOpen aria-hidden="true" /><span>Your library<small>Books, shelves, and reading history.</small></span></div>
          <div><Target aria-hidden="true" /><span>Your pace<small>Reading sessions and goals that fit you.</small></span></div>
          <div><NotebookPen aria-hidden="true" /><span>Your margins<small>Keep your notes and favorite passages.</small></span></div>
        </div>
      </section>
      <section className="reader-welcome-form space-y-6" aria-labelledby="account-title">
        <header>
          <h2 id="account-title" className="font-display text-3xl">{registering ? "Begin your next chapter" : "Welcome back"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{registering ? "Create an account and make yourself at home." : "Sign in to your reading life."}</p>
        </header>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              const username = String(data.get("username"));
              const password = String(data.get("password"));
              if (registering)
                await register(username, password, String(data.get("displayName") || username));
              else await login(username, password);
              await navigate({ to: "/" });
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Sign in failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            Username
            <input
              name="username"
              autoComplete="username"
              required
              className="mt-1 block w-full rounded-lg border border-border bg-background p-3"
            />
          </label>
          {registering && (
            <label className="block">
              Display name
              <input
                name="displayName"
                autoComplete="nickname"
                className="mt-1 block w-full rounded-lg border border-border bg-background p-3"
              />
            </label>
          )}
          <label className="block">
            Password
            <input
              name="password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              minLength={registering ? 6 : undefined}
              required
              className="mt-1 block w-full rounded-lg border border-border bg-background p-3"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <button
            disabled={busy || restoring}
            className="w-full rounded-lg bg-primary p-3 text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          disabled={busy}
          className="text-sm underline"
          onClick={() => {
            setRegistering(!registering);
            setError("");
          }}
        >
          {registering ? "Already have an account? Sign in" : "New to Rowan? Create an account"}
        </button>
      </section>
      </div>
    </main>
  );
}
