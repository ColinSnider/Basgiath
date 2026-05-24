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
  WandSparkles,
  Gem,
} from "lucide-react";
import { useState } from "react";
import {
  PRESET_THEMES,
  FONT_CHOICES,
  DISPLAY_FONT_CHOICES,
} from "@/lib/user-preferences";

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
  const [customThemeDraft, setCustomThemeDraft] = useState({
    name: "",
    lightPrimary: "#5a1a25",
    lightForeground: "#f8f5ec",
    darkPrimary: "#a63a4e",
    darkForeground: "#fff7eb",
  });

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
        text: error instanceof Error ? error.message : "Import failed. Please check your JSON file.",
      });
    } finally {
      setImporting(false);
    }
  }

  function createCustomTheme() {
    if (!customThemeDraft.name.trim()) {
      setDataMsg({ ok: false, text: "Custom theme name is required." });
      return;
    }
    const id = `custom-${crypto.randomUUID()}`;
    const nextThemes = [
      ...preferences.customThemes,
      {
        id,
        name: customThemeDraft.name.trim(),
        lightPrimary: customThemeDraft.lightPrimary,
        lightForeground: customThemeDraft.lightForeground,
        darkPrimary: customThemeDraft.darkPrimary,
        darkForeground: customThemeDraft.darkForeground,
      },
    ];
    updatePreferences({ customThemes: nextThemes, activeCustomThemeId: id });
    setDataMsg({ ok: true, text: "Custom theme saved." });
  }

  function removeCustomTheme(id: string) {
    const nextThemes = preferences.customThemes.filter((theme) => theme.id !== id);
    updatePreferences({
      customThemes: nextThemes,
      activeCustomThemeId: preferences.activeCustomThemeId === id ? null : preferences.activeCustomThemeId,
    });
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
        <section className="bg-card border border-border rounded-lg p-4 space-y-4 relative overflow-hidden">
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
                    updatePreferences({ activeCustomThemeId: null });
                  }}
                  title={c.label}
                  style={{ backgroundColor: c.hex }}
                  className={`group relative border rounded-md px-3 py-2 text-left transition-all ${
                    settings.accentColor === c.id && !preferences.activeCustomThemeId
                      ? "border-primary shadow-md bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                  }`}
                >
                  <span className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.label}</span>
                    {(c.id === "default" || c.id === "ocean" || c.id === "violet") && (
                      <Gem className="h-3.5 w-3.5 text-gold" />
                    )}
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
                {preferences.activeCustomThemeId
                  ? preferences.customThemes.find((t) => t.id === preferences.activeCustomThemeId)?.name ??
                    "Custom theme"
                  : PRESET_THEMES.find((c) => c.id === settings.accentColor)?.label ?? "Crimson"}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm inline-flex items-center gap-1"><WandSparkles className="h-3.5 w-3.5 text-primary" />Custom themes</p>
            {preferences.customThemes.length > 0 && (
              <div className="space-y-2">
                {preferences.customThemes.map((theme) => (
                  <div
                    key={theme.id}
                    className="flex items-center justify-between rounded-md border border-border px-2.5 py-2"
                  >
                    <button
                      onClick={() => updatePreferences({ activeCustomThemeId: theme.id })}
                      className={`text-xs ${preferences.activeCustomThemeId === theme.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {theme.name}
                    </button>
                    <button
                      onClick={() => removeCustomTheme(theme.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                value={customThemeDraft.name}
                onChange={(e) => setCustomThemeDraft((s) => ({ ...s, name: e.target.value }))}
                className="col-span-2 bg-muted rounded-md px-3 py-2 text-xs outline-none"
                placeholder="Theme name"
              />
              {(
                [
                  ["lightPrimary", "Light primary"],
                  ["lightForeground", "Light text"],
                  ["darkPrimary", "Dark primary"],
                  ["darkForeground", "Dark text"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-[11px] text-muted-foreground">
                  {label}
                  <input
                    type="color"
                    value={customThemeDraft[key]}
                    onChange={(e) =>
                      setCustomThemeDraft((s) => ({ ...s, [key]: e.target.value }))
                    }
                    className="mt-1 h-8 w-full rounded border border-border bg-card p-1"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={createCustomTheme}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/50"
            >
              <Plus className="h-3.5 w-3.5" /> Save custom theme
            </button>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Custom fonts</p>
                <p className="text-xs text-muted-foreground">Override default body and title fonts.</p>
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
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
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
          className="w-full border border-border rounded-lg py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30"
        >
          {user?.isGuest ? "Exit guest mode" : "Sign out"}
        </button>
      </div>

      <div className="pb-10" />
    </div>
  );
}
