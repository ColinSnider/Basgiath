import { useState, type CSSProperties } from "react";
import { BookOpen, Check, Moon, Palette, Save, Sun, Type } from "lucide-react";
import { PRESET_THEMES } from "@/lib/user-preferences";
import type { rowanSettings, RowanAccountCommand } from "@/lib/rowan-fns";
import { useAccountMutation } from "./useAccountMutation";

type Settings = Awaited<ReturnType<typeof rowanSettings>>["settings"];
export function AppearanceSettings({
  settings,
  save,
  disabled,
}: {
  settings: Settings;
  save: ReturnType<typeof useAccountMutation>;
  disabled: boolean;
}) {
  const saved: Extract<RowanAccountCommand, { type: "settings" }>["settings"] = {
    darkMode: settings.darkMode,
    accentColor: settings.accentColor,
    compactMode: settings.compactMode,
    fontScale: settings.fontScale === "sm" || settings.fontScale === "lg" ? settings.fontScale : "md",
  };
  const [draft, setDraft] = useState(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const theme = PRESET_THEMES.find((item) => item.id === draft.accentColor) ?? PRESET_THEMES[0];
  const palette = draft.darkMode ? theme.dark : theme.light;
  return (
    <section className="reader-card" aria-labelledby="appearance-heading">
      <header className="reader-card-heading">
        <div className="reader-section-title">
          <span className="reader-icon reader-icon-gold">
            <Palette size={20} />
          </span>
          <div>
            <h2 id="appearance-heading">Make yourself at home</h2>
            <p>Color, light, and a comfortable reading view.</p>
          </div>
        </div>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.run({ type: "settings", key: crypto.randomUUID(), settings: draft });
        }}
      >
        <fieldset className="reader-card-body space-y-6" disabled={disabled || save.busy}>
          <fieldset className="reader-choice-group">
            <legend>Appearance</legend>
            <div className="reader-mode-options">
              {[
                { dark: false, label: "Light", Icon: Sun },
                { dark: true, label: "Dark", Icon: Moon },
              ].map(({ dark, label, Icon }) => (
                <label key={label} className="reader-option">
                  <input
                    type="radio"
                    name="appearance"
                    checked={draft.darkMode === dark}
                    onChange={() => setDraft({ ...draft, darkMode: dark })}
                  />
                  <Icon size={18} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="reader-choice-group">
            <legend>Accent color</legend>
            <div className="reader-theme-options">
              {PRESET_THEMES.map((item) => (
                <label
                  key={item.id}
                  className="reader-theme-option"
                  style={{ "--swatch": item.hex } as CSSProperties}
                >
                  <input
                    type="radio"
                    name="accent"
                    value={item.id}
                    checked={draft.accentColor === item.id}
                    onChange={() => setDraft({ ...draft, accentColor: item.id })}
                  />
                  <span className="reader-swatch">
                    {draft.accentColor === item.id && <Check size={15} strokeWidth={3} />}
                  </span>
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div
            className="reader-theme-preview"
            style={{
              background: draft.darkMode ? theme.darkSurfaces.card : "oklch(0.98 0.01 80)",
              color: draft.darkMode ? "oklch(0.95 0.01 80)" : "oklch(0.22 0.04 20)",
              fontSize:
                draft.fontScale === "sm"
                  ? ".875rem"
                  : draft.fontScale === "lg"
                    ? "1.125rem"
                    : "1rem",
            }}
          >
            <span className="reader-caption">A little preview</span>
            <strong style={{ color: palette[0] }}>Every book is a new beginning.</strong>
            <p>A space that feels like you.</p>
            <span
              className="reader-preview-chip"
              style={{ background: palette[0], color: palette[1] }}
            >
              <BookOpen size={15} />
              Currently reading
            </span>
          </div>
          <div className="reader-setting-divider">
            <Type size={18} />
            <h3>Reading preferences</h3>
          </div>
          <fieldset className="reader-choice-group">
            <legend>Text size</legend>
            <div className="reader-mode-options">
              {(
                [
                  ["sm", "Small"],
                  ["md", "Medium"],
                  ["lg", "Large"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="reader-option">
                  <input
                    type="radio"
                    name="size"
                    checked={draft.fontScale === value}
                    onChange={() => setDraft({ ...draft, fontScale: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="reader-toggle-row">
            <span>
              <strong>Compact spacing</strong>
              <small>Fit more into your library and reading lists.</small>
            </span>
            <input
              type="checkbox"
              checked={draft.compactMode}
              onChange={(event) => setDraft({ ...draft, compactMode: event.target.checked })}
            />
          </label>
        </fieldset>
        <footer className="reader-settings-save">
          <p role="status">
            {save.message || (dirty ? "You have unsaved changes." : "Your saved preferences.")}
          </p>
          {save.uncertain ? (
            <button type="button" className="reader-button" onClick={save.retry}>
              Retry settings save
            </button>
          ) : (
            <button className="reader-button" disabled={disabled || save.busy || !dirty}>
              <Save size={16} />
              {save.busy ? "Saving…" : "Save preferences"}
            </button>
          )}
        </footer>
      </form>
    </section>
  );
}
