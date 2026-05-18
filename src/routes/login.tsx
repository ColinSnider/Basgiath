import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { startReplitAuth } from "@/lib/replit-auth-fns";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function ReplitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M3 3h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 13h4v4H3zM7 17h4v4H7z" />
    </svg>
  );
}

function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [replitLoading, setReplitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    navigate({ to: "/" });
    return null;
  }

  async function handleReplitLogin() {
    setReplitLoading(true);
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/callback`;
      const { authUrl, state, codeVerifier } = await startReplitAuth({
        data: { redirectUri },
      });
      sessionStorage.setItem("oidc_state", state);
      sessionStorage.setItem("oidc_verifier", codeVerifier);
      window.location.href = authUrl;
    } catch (err: any) {
      setError(err?.message ?? "Could not start Replit login. Try again.");
      setReplitLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
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
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl text-primary">Basgiath</h1>
          <p className="text-sm text-muted-foreground mt-1">A reader's companion</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          {/* Replit Auth */}
          <button
            type="button"
            onClick={handleReplitLogin}
            disabled={replitLoading}
            className="flex items-center justify-center gap-2 w-full bg-[#F5A623] hover:bg-[#e49520] disabled:opacity-60 text-white rounded-md py-2.5 text-sm font-medium transition-colors"
          >
            {replitLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ReplitIcon />
            )}
            Continue with Replit
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email / password tabs */}
          <div className="flex bg-muted rounded-lg p-0.5">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="text-xs text-muted-foreground">Your name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. avid_reader"
                autoComplete="username"
                required
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Email <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-5">
          Your reading data is private and tied to your account.
        </p>
      </div>
    </div>
  );
}
