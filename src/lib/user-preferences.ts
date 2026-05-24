export type FontScale = "sm" | "md" | "lg";
export type FontChoice = "inter" | "lora" | "source-sans" | "system";
export type DisplayFontChoice = "playfair" | "merriweather" | "lora" | "system";
export type TileWidth = "half" | "full";
export type DashboardWidgetId = "hero" | "stats" | "reading" | "notes" | "finished";

export type PresetTheme = {
  id: string;
  label: string;
  hex: string;
  light: [string, string];
  dark: [string, string];
  darkSurfaces: { bg: string; card: string; border: string; muted: string };
};

export type CustomTheme = {
  id: string;
  name: string;
  lightPrimary: string;
  lightForeground: string;
  darkPrimary: string;
  darkForeground: string;
};

export type DashboardTile = {
  widgetId: DashboardWidgetId;
  width: TileWidth;
};

export type UserPreferences = {
  useCustomFont: boolean;
  bodyFont: FontChoice;
  displayFont: DisplayFontChoice;
  customThemes: CustomTheme[];
  activeCustomThemeId: string | null;
  dashboardTiles: DashboardTile[];
};

export const PRESET_THEMES: PresetTheme[] = [
  {
    id: "default",
    label: "Crimson",
    hex: "#5a1a25",
    light: ["oklch(0.34 0.11 18)", "oklch(0.97 0.012 80)"],
    dark: ["oklch(0.5 0.14 20)", "oklch(0.98 0.01 80)"],
    darkSurfaces: {
      bg: "oklch(0.16 0.02 20)",
      card: "oklch(0.20 0.03 20)",
      border: "oklch(0.30 0.03 20)",
      muted: "oklch(0.26 0.04 20)",
    },
  },
  {
    id: "scarlet",
    label: "Scarlet",
    hex: "#b91c1c",
    light: ["oklch(0.48 0.18 25)", "oklch(0.98 0.01 70)"],
    dark: ["oklch(0.62 0.2 25)", "oklch(0.98 0.01 70)"],
    darkSurfaces: { bg: "oklch(0.16 0.022 25)", card: "oklch(0.2 0.028 25)", border: "oklch(0.3 0.03 25)", muted: "oklch(0.24 0.032 25)" },
  },
  {
    id: "sage",
    label: "Sage",
    hex: "#3a5c4a",
    light: ["oklch(0.35 0.07 155)", "oklch(0.97 0.01 130)"],
    dark: ["oklch(0.52 0.09 155)", "oklch(0.98 0.01 130)"],
    darkSurfaces: {
      bg: "oklch(0.15 0.018 155)",
      card: "oklch(0.19 0.022 155)",
      border: "oklch(0.28 0.026 155)",
      muted: "oklch(0.24 0.030 155)",
    },
  },
  {
    id: "forest",
    label: "Forest",
    hex: "#166534",
    light: ["oklch(0.4 0.11 152)", "oklch(0.97 0.01 145)"],
    dark: ["oklch(0.56 0.13 152)", "oklch(0.98 0.01 145)"],
    darkSurfaces: { bg: "oklch(0.14 0.016 152)", card: "oklch(0.18 0.02 152)", border: "oklch(0.27 0.025 152)", muted: "oklch(0.23 0.028 152)" },
  },
  {
    id: "ocean",
    label: "Ocean",
    hex: "#1a3a5c",
    light: ["oklch(0.33 0.09 245)", "oklch(0.97 0.01 245)"],
    dark: ["oklch(0.5 0.12 245)", "oklch(0.98 0.01 245)"],
    darkSurfaces: {
      bg: "oklch(0.15 0.018 245)",
      card: "oklch(0.19 0.022 245)",
      border: "oklch(0.28 0.026 245)",
      muted: "oklch(0.24 0.030 245)",
    },
  },
  {
    id: "sky",
    label: "Sky",
    hex: "#0ea5e9",
    light: ["oklch(0.63 0.14 240)", "oklch(0.15 0.02 250)"],
    dark: ["oklch(0.72 0.14 240)", "oklch(0.16 0.02 250)"],
    darkSurfaces: { bg: "oklch(0.15 0.016 240)", card: "oklch(0.2 0.02 240)", border: "oklch(0.28 0.024 240)", muted: "oklch(0.24 0.028 240)" },
  },
  {
    id: "violet",
    label: "Violet",
    hex: "#4c1d95",
    light: ["oklch(0.42 0.12 40)", "oklch(0.97 0.012 60)"],
    dark: ["oklch(0.58 0.14 40)", "oklch(0.98 0.01 60)"],
    darkSurfaces: {
      bg: "oklch(0.15 0.018 40)",
      card: "oklch(0.19 0.022 40)",
      border: "oklch(0.28 0.026 40)",
      muted: "oklch(0.24 0.030 40)",
    },
  },
  {
    id: "orchid",
    label: "Orchid",
    hex: "#a855f7",
    light: ["oklch(0.58 0.18 310)", "oklch(0.15 0.02 300)"],
    dark: ["oklch(0.7 0.2 310)", "oklch(0.16 0.02 300)"],
    darkSurfaces: {
      bg: "oklch(0.15 0.022 295)",
      card: "oklch(0.19 0.028 295)",
      border: "oklch(0.28 0.032 295)",
      muted: "oklch(0.24 0.036 295)",
    },
  },
  {
    id: "amber",
    label: "Amber",
    hex: "#b45309",
    light: ["oklch(0.52 0.14 70)", "oklch(0.18 0.02 80)"],
    dark: ["oklch(0.68 0.16 75)", "oklch(0.16 0.02 80)"],
    darkSurfaces: {
      bg: "oklch(0.16 0.018 70)",
      card: "oklch(0.20 0.022 70)",
      border: "oklch(0.30 0.026 70)",
      muted: "oklch(0.24 0.03 70)",
    },
  },
  {
    id: "rose-gold",
    label: "Rose Gold",
    hex: "#b76e79",
    light: ["oklch(0.58 0.08 20)", "oklch(0.14 0.02 30)"],
    dark: ["oklch(0.66 0.09 20)", "oklch(0.15 0.02 30)"],
    darkSurfaces: { bg: "oklch(0.16 0.015 20)", card: "oklch(0.2 0.02 20)", border: "oklch(0.3 0.024 20)", muted: "oklch(0.24 0.026 20)" },
  },
];

export const FONT_CHOICES: { id: FontChoice; label: string; cssVar: string }[] = [
  { id: "inter", label: "Inter", cssVar: '"Inter", system-ui, sans-serif' },
  { id: "lora", label: "Lora", cssVar: '"Lora", serif' },
  { id: "source-sans", label: "Source Sans 3", cssVar: '"Source Sans 3", system-ui, sans-serif' },
  { id: "system", label: "System", cssVar: "system-ui, sans-serif" },
];

export const DISPLAY_FONT_CHOICES: { id: DisplayFontChoice; label: string; cssVar: string }[] = [
  { id: "playfair", label: "Playfair Display", cssVar: '"Playfair Display", serif' },
  { id: "merriweather", label: "Merriweather", cssVar: '"Merriweather", serif' },
  { id: "lora", label: "Lora", cssVar: '"Lora", serif' },
  { id: "system", label: "System", cssVar: "system-ui, sans-serif" },
];

export const WIDGET_ORDER: DashboardWidgetId[] = ["hero", "stats", "reading", "notes", "finished"];

export const DEFAULT_PREFERENCES: UserPreferences = {
  useCustomFont: false,
  bodyFont: "inter",
  displayFont: "playfair",
  customThemes: [],
  activeCustomThemeId: null,
  dashboardTiles: [
    { widgetId: "hero", width: "full" },
    { widgetId: "stats", width: "full" },
    { widgetId: "reading", width: "full" },
    { widgetId: "notes", width: "half" },
    { widgetId: "finished", width: "half" },
  ],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHex(value: unknown) {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return trimmed;
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function normalizeCustomTheme(theme: unknown, idx: number): CustomTheme {
  if (!isObject(theme)) throw new Error(`customThemes[${idx}] must be an object.`);
  const name = normalizeOptionalString(theme.name);
  const id = normalizeOptionalString(theme.id) ?? `custom-${idx + 1}`;
  if (!name) throw new Error(`customThemes[${idx}].name is required.`);
  for (const field of ["lightPrimary", "lightForeground", "darkPrimary", "darkForeground"] as const) {
    if (!isHex(theme[field])) {
      throw new Error(`customThemes[${idx}].${field} must be a valid hex color like #123abc.`);
    }
  }
  return {
    id,
    name,
    lightPrimary: normalizeHex(theme.lightPrimary as string),
    lightForeground: normalizeHex(theme.lightForeground as string),
    darkPrimary: normalizeHex(theme.darkPrimary as string),
    darkForeground: normalizeHex(theme.darkForeground as string),
  };
}

export function normalizeDashboardTiles(input: unknown): DashboardTile[] {
  const source = Array.isArray(input) ? input : DEFAULT_PREFERENCES.dashboardTiles;
  const seen = new Set<DashboardWidgetId>();
  const normalized: DashboardTile[] = [];

  for (const tile of source) {
    if (!isObject(tile)) continue;
    const widgetId = tile.widgetId;
    if (!WIDGET_ORDER.includes(widgetId as DashboardWidgetId)) continue;
    if (seen.has(widgetId as DashboardWidgetId)) continue;
    seen.add(widgetId as DashboardWidgetId);
    normalized.push({
      widgetId: widgetId as DashboardWidgetId,
      width: tile.width === "full" ? "full" : "half",
    });
  }

  for (const widgetId of WIDGET_ORDER) {
    if (seen.has(widgetId)) continue;
    normalized.push({
      widgetId,
      width: DEFAULT_PREFERENCES.dashboardTiles.find((t) => t.widgetId === widgetId)?.width ?? "half",
    });
  }
  return normalized;
}

export function normalizeUserPreferences(input: unknown): UserPreferences {
  if (!isObject(input)) return DEFAULT_PREFERENCES;

  const bodyFont = FONT_CHOICES.some((f) => f.id === input.bodyFont) ? (input.bodyFont as FontChoice) : DEFAULT_PREFERENCES.bodyFont;
  const displayFont = DISPLAY_FONT_CHOICES.some((f) => f.id === input.displayFont)
    ? (input.displayFont as DisplayFontChoice)
    : DEFAULT_PREFERENCES.displayFont;
  const customThemesRaw = Array.isArray(input.customThemes) ? input.customThemes : [];
  const customThemes = customThemesRaw
    .map((theme, idx) => {
      try {
        return normalizeCustomTheme(theme, idx);
      } catch {
        return null;
      }
    })
    .filter((v): v is CustomTheme => !!v);
  const activeCustomThemeId = normalizeOptionalString(input.activeCustomThemeId);
  return {
    useCustomFont: input.useCustomFont === true,
    bodyFont,
    displayFont,
    customThemes,
    activeCustomThemeId,
    dashboardTiles: normalizeDashboardTiles(input.dashboardTiles),
  };
}

export type ExportData = {
  version: 1;
  exportedAt: string;
  books: unknown[];
  margins: unknown[];
  goals: unknown[];
  settings: {
    darkMode: boolean;
    accentColor: string;
    compactMode: boolean;
    fontScale: FontScale;
  };
  preferences: UserPreferences;
};

export function parseImportJson(raw: string): ExportData {
  const text = raw.trim();
  if (!text) throw new Error("Import failed: choose a JSON file with export data.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Import failed: file is not valid JSON.");
  }

  if (!isObject(parsed)) throw new Error("Import failed: root JSON value must be an object.");
  if (!Array.isArray(parsed.books)) throw new Error("Import failed: books must be an array.");
  if (!Array.isArray(parsed.margins)) throw new Error("Import failed: margins must be an array.");
  if (!Array.isArray(parsed.goals)) throw new Error("Import failed: goals must be an array.");

  const settingsCandidate = isObject(parsed.settings)
    ? parsed.settings
    : isObject(parsed.userSettings)
      ? parsed.userSettings
      : parsed;

  const fontScaleRaw = settingsCandidate.fontScale;
  const fontScale: FontScale =
    fontScaleRaw === "sm" || fontScaleRaw === "md" || fontScaleRaw === "lg"
      ? fontScaleRaw
      : "md";

  const darkMode =
    typeof settingsCandidate.darkMode === "boolean"
      ? settingsCandidate.darkMode
      : false;

  const compactMode =
    typeof settingsCandidate.compactMode === "boolean"
      ? settingsCandidate.compactMode
      : false;

  const accentColor =
    typeof settingsCandidate.accentColor === "string" && settingsCandidate.accentColor.trim().length > 0
      ? settingsCandidate.accentColor
      : "default";

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    books: parsed.books,
    margins: parsed.margins,
    goals: parsed.goals,
    settings: {
      darkMode,
      compactMode,
      accentColor,
      fontScale,
    },
    preferences: normalizeUserPreferences(parsed.preferences),
  };
}
