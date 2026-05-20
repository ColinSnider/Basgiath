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
    id: "sunset",
    label: "Sunset",
    hex: "#8b3a1a",
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
    id: "slate",
    label: "Slate",
    hex: "#374151",
    light: ["oklch(0.35 0.025 255)", "oklch(0.97 0.005 255)"],
    dark: ["oklch(0.52 0.03 255)", "oklch(0.98 0.005 255)"],
    darkSurfaces: {
      bg: "oklch(0.15 0.012 255)",
      card: "oklch(0.19 0.015 255)",
      border: "oklch(0.28 0.018 255)",
      muted: "oklch(0.24 0.020 255)",
    },
  },
  {
    id: "violet",
    label: "Violet",
    hex: "#4c1d95",
    light: ["oklch(0.33 0.16 295)", "oklch(0.97 0.01 295)"],
    dark: ["oklch(0.52 0.18 295)", "oklch(0.98 0.01 295)"],
    darkSurfaces: {
      bg: "oklch(0.15 0.022 295)",
      card: "oklch(0.19 0.028 295)",
      border: "oklch(0.28 0.032 295)",
      muted: "oklch(0.24 0.036 295)",
    },
  },
  {
    id: "pine",
    label: "Pine",
    hex: "#14532d",
    light: ["oklch(0.34 0.09 155)", "oklch(0.97 0.01 150)"],
    dark: ["oklch(0.5 0.12 155)", "oklch(0.98 0.01 150)"],
    darkSurfaces: {
      bg: "oklch(0.14 0.016 155)",
      card: "oklch(0.18 0.02 155)",
      border: "oklch(0.27 0.024 155)",
      muted: "oklch(0.23 0.028 155)",
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
    lightPrimary: (theme.lightPrimary as string).trim(),
    lightForeground: (theme.lightForeground as string).trim(),
    darkPrimary: (theme.darkPrimary as string).trim(),
    darkForeground: (theme.darkForeground as string).trim(),
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
  if (!isObject(parsed.settings)) throw new Error("Import failed: settings must be an object.");

  const settingsRaw = parsed.settings;
  const fontScale = settingsRaw.fontScale;
  if (fontScale !== "sm" && fontScale !== "md" && fontScale !== "lg") {
    throw new Error("Import failed: settings.fontScale must be one of sm, md, or lg.");
  }
  if (typeof settingsRaw.darkMode !== "boolean")
    throw new Error("Import failed: settings.darkMode must be true or false.");
  if (typeof settingsRaw.compactMode !== "boolean")
    throw new Error("Import failed: settings.compactMode must be true or false.");
  if (typeof settingsRaw.accentColor !== "string")
    throw new Error("Import failed: settings.accentColor must be a string.");

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    books: parsed.books,
    margins: parsed.margins,
    goals: parsed.goals,
    settings: {
      darkMode: settingsRaw.darkMode,
      compactMode: settingsRaw.compactMode,
      accentColor: settingsRaw.accentColor,
      fontScale,
    },
    preferences: normalizeUserPreferences(parsed.preferences),
  };
}

