import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { BookOpen, Compass, Loader2, Sparkles, Target } from "lucide-react";
import { GUEST_BROWSE_MESSAGE } from "@/lib/session-auth.js";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, register, continueAsGuest, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && !user.isGuest) {
    navigate({ to: "/" });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, displayName || username, email || undefined);
      }
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueAsGuest() {
    setError(null);
    setLoading(true);
    try {
      await continueAsGuest();
      navigate({ to: "/" });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to continue as guest. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10 md:px-10 xl:px-14">
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 lg:grid-cols-[minmax(520px,0.95fr)_minmax(520px,1.05fr)]">
        <section className="hidden lg:flex min-h-[44rem] rounded-[2rem] border border-gold/40 bg-gradient-to-br from-primary via-primary/90 to-gold/75 text-primary-foreground p-12 shadow-[0_24px_80px_-30px_rgba(86,25,34,0.7)] flex-col justify-between relative overflow-hidden">
          <Sparkles className="absolute -right-8 top-8 h-28 w-28 text-gold/30" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary-foreground/75">Basgiath</p>
            <h2 className="font-display text-6xl mt-4 leading-tight">Read with momentum.</h2>
            <p className="mt-5 text-lg text-primary-foreground/85 max-w-lg">
              Your elegant reading command center for books, margins, goals, and audiobook progress.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-gold/45 bg-black/15 p-3 space-y-2">
              <BookOpen className="h-4 w-4 text-gold" />
              <p className="font-medium leading-snug">Track books and audiobooks in one timeline.</p>
            </div>
            <div className="rounded-xl border border-gold/45 bg-black/15 p-3 space-y-2">
              <Target className="h-4 w-4 text-gold" />
              <p className="font-medium leading-snug">Turn yearly goals into daily momentum.</p>
            </div>
            <div className="rounded-xl border border-gold/45 bg-black/15 p-3 space-y-2">
              <Compass className="h-4 w-4 text-gold" />
              <p className="font-medium leading-snug">Capture insights with margin notes and highlights.</p>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[620px] lg:justify-self-center bg-card/95 border border-gold/40 rounded-[1.5rem] p-6 md:p-9 shadow-[0_20px_50px_-32px_rgba(81,43,20,0.65)] backdrop-blur-sm space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {mode === "login" ? "Sign In" : "Create Account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Welcome back. Sign in to continue."
                : "Create a new account to get started."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. avid_reader"
                autoComplete="username"
                required
                className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {mode === "register" && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Display Name{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should we call you?"
                    className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Email <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>

            {mode === "login" && (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>Just browsing?</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  disabled={loading}
                  className="w-full border border-border rounded-md py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Continue as Guest
                </button>
                <p className="text-xs text-muted-foreground">{GUEST_BROWSE_MESSAGE}</p>
              </>
            )}
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
