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
  Download,
  Upload,
  Plus,
  Sparkles,
  Gem,
} from "lucide-react";
import { useState } from "react";
import { PRESET_THEMES, FONT_CHOICES, DISPLAY_FONT_CHOICES } from "@/lib/user-preferences";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  const {
    settings,
    preferences,
    updateSettings,
    updatePreferences,
    importUserData,
    exportUserData,
    clearAll,
  } = useStore();
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
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);

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

  function doExportJson() {
    try {
      const payload = exportUserData();
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `basgiath-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDataMsg({ ok: true, text: "Export complete. JSON file downloaded." });
    } catch {
      setDataMsg({ ok: false, text: "Export failed. Please try again." });
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    setDataMsg(null);
    try {
      const text = await file.text();
      await importUserData(text);
      setDataMsg({ ok: true, text: "Import complete. Your data and settings were restored." });
    } catch (error) {
      setDataMsg({
        ok: false,
        text:
          error instanceof Error ? error.message : "Import failed. Please check your JSON file.",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" /> Home
        </Link>
      </div>

      <div className="px-5 pt-2 pb-8 md:px-8 xl:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] items-start gap-8 lg:grid-cols-[minmax(430px,0.9fr)_minmax(700px,1.1fr)]">
          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-gold/40 bg-gradient-to-br from-primary via-primary/90 to-gold/75 p-8 text-primary-foreground shadow-[0_24px_80px_-30px_rgba(86,25,34,0.7)]">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-foreground/75">Preferences</p>
              <h1 className="font-display text-5xl mt-3">Settings</h1>
              <p className="mt-3 text-primary-foreground/85">Tune your profile, themes, reading behavior, and backups.</p>
              <div className="grid grid-cols-3 gap-2 text-xs mt-6">
                <div className="rounded-lg border border-gold/40 bg-black/15 p-2">Account controls</div>
                <div className="rounded-lg border border-gold/40 bg-black/15 p-2">Theme polish</div>
                <div className="rounded-lg border border-gold/40 bg-black/15 p-2">Backup + restore</div>
              </div>
            </div>
          </aside>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Account */}
          <section className="bg-card border border-gold/30 rounded-2xl p-5 space-y-4 shadow-[0_14px_40px_-32px_rgba(120,86,38,0.7)] 2xl:col-span-2">
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
              <div className="flex flex-col sm:flex-row gap-2">
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
              <div className="flex flex-col sm:flex-row gap-2">
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
          <section className="bg-card border border-gold/30 rounded-2xl p-5 space-y-3 shadow-[0_14px_40px_-32px_rgba(120,86,38,0.7)]">
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
          <section className="bg-card border border-gold/30 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-[0_14px_40px_-32px_rgba(120,86,38,0.7)]">
            <Sparkles className="h-20 w-20 absolute -right-4 -top-5 text-primary/15" />
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
              <p className="text-sm mb-2.5">Signature themes</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {PRESET_THEMES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      updateSettings({ accentColor: c.id });
                      updatePreferences({ activeCustomThemeId: null, customThemes: [] });
                    }}
                    title={c.label}
                    style={{ backgroundColor: c.hex }}
                    className={`group relative border rounded-md px-3 py-2 text-left transition-all ${
                      settings.accentColor === c.id
                        ? "border-primary shadow-md bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    <span className="flex items-center justify-between text-xs">
                      <span className="font-medium">{c.label}</span>
                      {(c.id === "default" ||
                        c.id === "ocean" ||
                        c.id === "violet" ||
                        c.id === "scarlet") && <Gem className="h-3.5 w-3.5 text-gold" />}
                    </span>
                    <span
                      style={{ backgroundColor: c.hex }}
                      className="mt-2 h-2.5 w-full rounded-full block border border-black/10"
                    />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Current:{" "}
                <span className="font-medium capitalize">
                  {PRESET_THEMES.find((c) => c.id === settings.accentColor)?.label ?? "Crimson"}
                </span>
              </p>
            </div>
          </section>

          {/* Reading */}
          <section className="bg-card border border-gold/30 rounded-2xl p-5 space-y-4 shadow-[0_14px_40px_-32px_rgba(120,86,38,0.7)]">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Custom fonts</p>
                  <p className="text-xs text-muted-foreground">
                    Override default body and title fonts.
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ useCustomFont: !preferences.useCustomFont })}
                  className={`relative h-7 w-12 rounded-full transition-colors ${preferences.useCustomFont ? "bg-primary" : "bg-muted"}`}
                  aria-pressed={preferences.useCustomFont}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-all ${preferences.useCustomFont ? "left-[1.375rem]" : "left-0.5"}`}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Body font
                  <select
                    disabled={!preferences.useCustomFont}
                    value={preferences.bodyFont}
                    onChange={(e) =>
                      updatePreferences({
                        bodyFont: e.target.value as (typeof preferences)["bodyFont"],
                      })
                    }
                    className="mt-1 w-full bg-muted rounded-md px-2 py-1.5 text-xs outline-none disabled:opacity-50"
                  >
                    {FONT_CHOICES.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Display font
                  <select
                    disabled={!preferences.useCustomFont}
                    value={preferences.displayFont}
                    onChange={(e) =>
                      updatePreferences({
                        displayFont: e.target.value as (typeof preferences)["displayFont"],
                      })
                    }
                    className="mt-1 w-full bg-muted rounded-md px-2 py-1.5 text-xs outline-none disabled:opacity-50"
                  >
                    {DISPLAY_FONT_CHOICES.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </label>
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
          <section className="bg-card border border-gold/30 rounded-2xl p-5 space-y-3 2xl:col-span-2 shadow-[0_14px_40px_-32px_rgba(120,86,38,0.7)]">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layout className="h-4 w-4 text-muted-foreground" /> Data
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={doExportJson}
                className="inline-flex items-center justify-center gap-1.5 border border-border rounded-lg py-2 text-sm hover:bg-muted/40"
              >
                <Download className="h-4 w-4" /> Export JSON
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 border border-border rounded-lg py-2 text-sm hover:bg-muted/40">
                <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import JSON"}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {dataMsg && (
              <p className={`text-xs ${dataMsg.ok ? "text-green-600" : "text-destructive"}`}>
                {dataMsg.text}
              </p>
            )}
            <button
              onClick={doClear}
              className="w-full inline-flex items-center justify-center gap-1.5 border border-destructive/30 text-destructive rounded-lg py-2.5 text-sm hover:bg-destructive/5"
            >
              <Trash2 className="h-4 w-4" /> Erase all reading data
            </button>
          </section>

          <button
            onClick={doLogout}
            className="w-full border border-border rounded-lg py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 2xl:col-span-2"
          >
            {user?.isGuest ? "Exit guest mode" : "Sign out"}
          </button>
          </div>
        </div>
      </div>

      <div className="pb-10" />
    </div>
  );
}
