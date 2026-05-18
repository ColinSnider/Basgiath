import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeReplitCode } from "@/lib/replit-auth-fns";
import { BookOpen, Loader2 } from "lucide-react";

const SESSION_KEY = "basgiath:session";
const OIDC_STATE_KEY = "oidc_state";
const OIDC_VERIFIER_KEY = "oidc_verifier";

export const Route = createFileRoute("/callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
    state: typeof s.state === "string" ? s.state : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { code, state, error } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function handleCallback() {
      if (error) {
        setStatus("error");
        setMessage(`Authentication cancelled: ${error}`);
        return;
      }
      if (!code || !state) {
        setStatus("error");
        setMessage("Missing code or state from Replit.");
        return;
      }

      const expectedState = sessionStorage.getItem(OIDC_STATE_KEY);
      const codeVerifier = sessionStorage.getItem(OIDC_VERIFIER_KEY);

      if (!expectedState || !codeVerifier) {
        setStatus("error");
        setMessage("Auth session expired. Please try again.");
        return;
      }

      if (state !== expectedState) {
        setStatus("error");
        setMessage("Invalid state parameter. Please try again.");
        return;
      }

      try {
        const fullCallbackUrl = window.location.href;
        const result = await exchangeReplitCode({
          data: { fullCallbackUrl, codeVerifier, expectedState },
        });

        sessionStorage.removeItem(OIDC_STATE_KEY);
        sessionStorage.removeItem(OIDC_VERIFIER_KEY);

        localStorage.setItem(SESSION_KEY, result.sessionId);
        navigate({ to: "/" });
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message ?? "Authentication failed. Please try again.");
      }
    }
    handleCallback();
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
            <BookOpen className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-2xl text-primary">Basgiath</h1>
          <p className="text-sm text-destructive">{message}</p>
          <a href="/login" className="inline-block text-sm text-primary underline">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
        <p className="font-display text-2xl text-primary">Basgiath</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing you in…
        </div>
      </div>
    </div>
  );
}
