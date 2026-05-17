import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import { updateDisplayName, changePassword } from "@/lib/auth-fns";
import { ChevronLeft, Moon, Sun, Trash2, Type, Palette, Layout, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const ACCENT_COLORS = [
  { id: "default", label: "Crimson", class: "bg-[#5a1a25]" },
  { id: "sage", label: "Sage", class: "bg-[#3a5c4a]" },
  { id: "ocean", label: "Ocean", class: "bg-[#1a3a5c]" },
  { id: "sunset", label: "Sunset", class: "bg-[#8b3a1a]" },
  { id: "slate", label: "Slate", class: "bg-[#374151]" },
  { id: "violet", label: "Violet", class: "bg-[#4c1d95]" },
];

function Settings() {
  const { settings, updateSettings, clearAll } = useStore();
  const { user, sessionId, updateDisplayName: updateLocalName, logout } = useAuth();
  const navigate = useNavigate();

  const [nameVal, setNameVal] = useState(user?.displayName ?? "");
  const [nameSaving, setNameSaving] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !nameVal.trim()) return;
    setNameSaving(true);
    try {
      await updateDisplayName({ data: { sessionId, displayName: nameVal.trim() } });
      updateLocalName(nameVal.trim());
    } finally {
      setNameSaving(false);
    }
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setPwSaving(true);
    setPwMsg(null);
    try {
      await changePassword({ data: { sessionId, currentPassword: curPw, newPassword: newPw } });
      setCurPw(""); setNewPw("");
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (err: any) {
      setPwMsg({ ok: false, text: err?.message ?? "Failed to update password." });
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
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" /> Home
        </Link>
      </div>

      <header className="px-5 pt-2 pb-6">
        <h1 className="font-display text-3xl text-primary">Settings</h1>
      </header>

      <div className="px-5 space-y-5">
        {/* Display name */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" /> Account
          </div>
          <form onSubmit={saveName} className="flex gap-2">
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
          </form>
          <p className="text-xs text-muted-foreground">Signed in as <span className="font-medium">@{user?.username}</span></p>
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
            {pwMsg && <p className={`text-xs ${pwMsg.ok ? "text-green-600" : "text-destructive"}`}>{pwMsg.text}</p>}
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
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow flex items-center justify-center transition-all ${settings.darkMode ? "left-[1.375rem]" : "left-0.5"}`}>
                {settings.darkMode ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              </span>
            </button>
          </div>

          <div>
            <p className="text-sm mb-2">Accent colour</p>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateSettings({ accentColor: c.id })}
                  title={c.label}
                  className={`h-8 w-8 rounded-full ${c.class} transition-all ${settings.accentColor === c.id ? "ring-2 ring-offset-2 ring-foreground/50 scale-110" : "opacity-70 hover:opacity-100"}`}
                />
              ))}
            </div>
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
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition-all ${settings.compactMode ? "left-[1.375rem]" : "left-0.5"}`} />
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
          Sign out
        </button>
      </div>

      <div className="pb-10" />
    </div>
  );
}
