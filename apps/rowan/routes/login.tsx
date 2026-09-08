import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { login, register, user, loading: restoring } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user && !user.isGuest) void navigate({ to: "/" });
  }, [user, navigate]);
  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <section className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8">
        <header>
          <p className="font-display text-4xl text-primary">Rowan</p>
          <h1 className="mt-4 text-xl">{registering ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground">A home for your reading life.</p>
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
    </main>
  );
}
