import { useState } from "react";
import { LockKeyhole, Mail, Save, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { changePassword, updateDisplayName, updateEmail } from "@/lib/auth-fns";

export function ProfileSettings({ sessionId, section = "all" }: { sessionId: string; section?: "profile" | "security" | "all" }) {
  const auth = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ section: string; text: string; error: boolean } | null>(
    null,
  );
  async function submit(section: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(section);
    setMessage(null);
    try {
      await action();
      setMessage({
        section,
        text: section === "password" ? "Password updated." : "Profile updated.",
        error: false,
      });
    } catch (error) {
      setMessage({
        section,
        text:
          error instanceof Error
            ? error.message
            : "This change could not be saved. Please try again.",
        error: true,
      });
    } finally {
      setBusy(null);
    }
  }
  const feedback = (section: string) =>
    message?.section === section && (
      <p
        role={message.error ? "alert" : "status"}
        className={message.error ? "text-destructive" : "reader-muted"}
      >
        {message.text}
      </p>
    );
  return (
    <>
      {section !== "security" && <section className="reader-card" aria-labelledby="profile-heading">
        <header className="reader-card-heading">
          <div className="reader-section-title">
            <span className="reader-icon">
              <UserRound size={20} />
            </span>
            <div>
              <h2 id="profile-heading">Your profile</h2>
              <p>A familiar face between the pages.</p>
            </div>
          </div>
        </header>
        <div className="reader-card-body space-y-5">
          <div className="reader-profile-summary">
            <span className="reader-avatar" aria-hidden="true">
              {(auth.user?.displayName || auth.user?.username || "R").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{auth.user?.displayName || auth.user?.username}</strong>
              <p className="reader-muted">@{auth.user?.username}</p>
            </div>
          </div>
          <form
            className="reader-setting-form"
            onSubmit={(event) => {
              event.preventDefault();
              const displayName = String(
                new FormData(event.currentTarget).get("displayName"),
              ).trim();
              void submit("name", async () => {
                const result = await updateDisplayName({ data: { sessionId, displayName } });
                auth.updateDisplayName(result.displayName);
              });
            }}
          >
            <label htmlFor="profile-name">Display name</label>
            <div className="reader-field-action">
              <input
                id="profile-name"
                name="displayName"
                autoComplete="nickname"
                required
                maxLength={100}
                defaultValue={auth.user?.displayName || ""}
              />
              <button className="reader-button" disabled={!!busy}>
                <Save size={16} />
                {busy === "name" ? "Saving…" : "Save name"}
              </button>
            </div>
            {feedback("name")}
          </form>
          <form
            className="reader-setting-form"
            onSubmit={(event) => {
              event.preventDefault();
              const email = String(new FormData(event.currentTarget).get("email")).trim();
              void submit("email", async () => {
                const result = await updateEmail({ data: { sessionId, email } });
                auth.updateEmail(result.email || email);
              });
            }}
          >
            <label htmlFor="profile-email">Email address</label>
            <div className="reader-field-action">
              <input
                id="profile-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={auth.user?.email || ""}
                placeholder="you@example.com"
              />
              <button className="reader-button" disabled={!!busy}>
                <Mail size={16} />
                {busy === "email" ? "Saving…" : "Save email"}
              </button>
            </div>
            <p className="reader-muted">
              Your username stays the same when you update your name or email.
            </p>
            {feedback("email")}
          </form>
        </div>
      </section>}
      {section !== "profile" && <section className="reader-card" aria-labelledby="security-heading">
        <header className="reader-card-heading">
          <div className="reader-section-title">
            <span className="reader-icon">
              <LockKeyhole size={20} />
            </span>
            <div>
              <h2 id="security-heading">Sign-in & security</h2>
              <p>Keep your reading life yours.</p>
            </div>
          </div>
        </header>
        <div className="reader-card-body">
          <details className="reader-disclosure">
            <summary>Change password</summary>
            <form
              className="reader-setting-form mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const newPassword = String(data.get("newPassword"));
                if (newPassword !== data.get("confirmPassword")) {
                  setMessage({
                    section: "password",
                    text: "The new passwords do not match.",
                    error: true,
                  });
                  return;
                }
                void submit("password", async () => {
                  await changePassword({
                    data: {
                      sessionId,
                      currentPassword: String(data.get("currentPassword")),
                      newPassword,
                    },
                  });
                  form.reset();
                });
              }}
            >
              <input
                type="hidden"
                name="username"
                value={auth.user?.username || ""}
                autoComplete="username"
              />
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                aria-describedby="password-help"
              />
              <p id="password-help" className="reader-muted">
                Use at least 6 characters.
              </p>
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button className="reader-button" disabled={!!busy}>
                {busy === "password" ? "Updating…" : "Update password"}
              </button>
              {feedback("password")}
            </form>
          </details>
        </div>
      </section>}
    </>
  );
}
