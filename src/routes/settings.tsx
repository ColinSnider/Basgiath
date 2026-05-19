import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import { updateDisplayName, changePassword, updateEmail as updateEmailFn } from "@/lib/auth-fns";
import { GUEST_BROWSE_MESSAGE } from "@/lib/session-auth.js";
import {
  ChevronLeft,
  Moon,
  Sun,
  Trash2,
  Type,
  Palette,
  Layout,
  KeyRound,
  Loader2,
  Mail,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const ACCENT_COLORS = [
  { id: "default", label: "Crimson", hex: "#5a1a25" },
  { id: "sage", label: "Sage", hex: "#3a5c4a" },
  { id: "ocean", label: "Ocean", hex: "#1a3a5c" },
  { id: "sunset", label: "Sunset", hex: "#8b3a1a" },
  { id: "slate", label: "Slate", hex: "#374151" },
  { id: "violet", label: "Violet", hex: "#4c1d95" },
];

function Settings() {
  const { settings, updateSettings, clearAll } = useStore();
  const {
    user,
    sessionId,
    updateDisplayName: updateLocalName,
    updateEmail: updateLocalEmail,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [nameVal, setNameVal] = useState(user?.displayName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [emailVal, setEmailVal] = useState(user?.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !nameVal.trim()) return;
    setNameSaving(true);
    setNameMsg(null);
    try {
      await updateDisplayName({ data: { sessionId, displayName: nameVal.trim() } });
      updateLocalName(nameVal.trim());
      setNameMsg({ ok: true, text: "Display name saved." });
    } catch (err: unknown) {
      setNameMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to save display name.",
      });
    } finally {
      setNameSaving(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !emailVal.trim()) return;
    setEmailSaving(true);
    setEmailMsg(null);
    try {
      await updateEmailFn({ data: { sessionId, email: emailVal.trim() } });
      updateLocalEmail(emailVal.trim());
      setEmailMsg({ ok: true, text: "Email saved." });
    } catch (err: unknown) {
      setEmailMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to save email.",
      });
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setPwSaving(true);
    setPwMsg(null);
    try {
      await changePassword({ data: { sessionId, currentPassword: curPw, newPassword: newPw } });
      setCurPw("");
      setNewPw("");
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (err: unknown) {
      setPwMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setPwSaving(false);
    }
  }

  async function doLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  async function doClear() {
    if (!confirm("Erase all your books, margins, and goals? This can't be undone.")) return;
    await clearAll();
  }

  return (
    <div>
      <div className="px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" /> Home
        </Link>
      </div>

      <header className="px-5 pt-2 pb-6">
        <h1 className="font-display text-3xl text-primary">Settings</h1>
      </header>

      <div className="px-5 space-y-5">
        {/* Account */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> Account
          </div>

          <p className="text-xs text-muted-foreground -mt-1">
            Signed in as <span className="font-medium">@{user?.username}</span>
          </p>
          {user?.isGuest && (
            <p className="text-xs text-muted-foreground -mt-2">{GUEST_BROWSE_MESSAGE}</p>
          )}

          {/* Display name */}
          <form onSubmit={saveName} className="space-y-1">
            <label className="text-xs text-muted-foreground">Display name</label>
            <div className="flex gap-2">
              <input
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                placeholder="Display name"
                className="flex-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={nameSaving}
                className="bg-primary text-primary-foreground text-sm rounded-md px-3 py-2 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {nameSaving && <Loader2 className="h-3 w-3 animate-spin" />} Save
              </button>
            </div>
            {nameMsg && (
              <p className={`text-xs ${nameMsg.ok ? "text-green-600" : "text-destructive"}`}>
                {nameMsg.text}
              </p>
            )}
          </form>

          {/* Email */}
          <form onSubmit={saveEmail} className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email address
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailVal}
                onChange={(e) => setEmailVal(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={emailSaving}
                className="bg-primary text-primary-foreground text-sm rounded-md px-3 py-2 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {emailSaving && <Loader2 className="h-3 w-3 animate-spin" />} Save
              </button>
            </div>
            {emailMsg && (
              <p className={`text-xs ${emailMsg.ok ? "text-green-600" : "text-destructive"}`}>
                {emailMsg.text}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Used for account recovery only. Never shared.
            </p>
          </form>
        </section>

        {/* Password */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> Change password
          </div>
          <form onSubmit={savePw} className="space-y-2">
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="Current password"
              className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
            />
            {pwMsg && (
              <p className={`text-xs ${pwMsg.ok ? "text-green-600" : "text-destructive"}`}>
                {pwMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={pwSaving}
              className="w-full bg-primary text-primary-foreground text-sm rounded-md py-2 font-medium disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {pwSaving && <Loader2 className="h-3 w-3 animate-spin" />} Update password
            </button>
          </form>
        </section>

        {/* Appearance */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-muted-foreground" /> Appearance
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Dark mode</p>
              <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
            </div>
            <button
              onClick={() => updateSettings({ darkMode: !settings.darkMode })}
              className={`relative h-7 w-12 rounded-full transition-colors ${settings.darkMode ? "bg-primary" : "bg-muted"}`}
              aria-pressed={settings.darkMode}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow flex items-center justify-center transition-all ${settings.darkMode ? "left-[1.375rem]" : "left-0.5"}`}
              >
                {settings.darkMode ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              </span>
            </button>
          </div>

          <div>
            <p className="text-sm mb-2.5">Accent colour</p>
            <div className="flex gap-3 flex-wrap">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateSettings({ accentColor: c.id })}
                  title={c.label}
                  style={{ backgroundColor: c.hex }}
                  className={`h-9 w-9 rounded-full transition-all ${
                    settings.accentColor === c.id
                      ? "ring-2 ring-offset-2 ring-foreground/60 scale-110"
                      : "opacity-60 hover:opacity-90 hover:scale-105"
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Current:{" "}
              <span className="font-medium capitalize">
                {ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.label ?? "Crimson"}
              </span>
            </p>
          </div>
        </section>

        {/* Reading */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4 text-muted-foreground" /> Reading preferences
          </div>

          <div>
            <p className="text-sm mb-2">Text size</p>
            <div className="flex gap-1 p-1 bg-muted rounded-md">
              {(["sm", "md", "lg"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateSettings({ fontScale: s })}
                  className={`flex-1 py-1.5 text-xs rounded-sm font-medium ${settings.fontScale === s ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {s === "sm" ? "Small" : s === "md" ? "Default" : "Large"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Compact mode</p>
              <p className="text-xs text-muted-foreground">Denser list views.</p>
            </div>
            <button
              onClick={() => updateSettings({ compactMode: !settings.compactMode })}
              className={`relative h-7 w-12 rounded-full transition-colors ${settings.compactMode ? "bg-primary" : "bg-muted"}`}
              aria-pressed={settings.compactMode}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-all ${settings.compactMode ? "left-[1.375rem]" : "left-0.5"}`}
              />
            </button>
          </div>
        </section>

        {/* Data */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layout className="h-4 w-4 text-muted-foreground" /> Data
          </div>
          <button
            onClick={doClear}
            className="w-full inline-flex items-center justify-center gap-1.5 border border-destructive/30 text-destructive rounded-lg py-2.5 text-sm hover:bg-destructive/5"
          >
            <Trash2 className="h-4 w-4" /> Erase all reading data
          </button>
        </section>

        <button
          onClick={doLogout}
          className="w-full border border-border rounded-lg py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30"
        >
          {user?.isGuest ? "Exit guest mode" : "Sign out"}
        </button>
      </div>

      <div className="pb-10" />
    </div>
  );
}
