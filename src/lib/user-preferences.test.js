import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFERENCES,
  normalizeDashboardTiles,
  normalizeUserPreferences,
  parseImportJson,
} from "./user-preferences.ts";

test("normalizeDashboardTiles deduplicates widgets and preserves deterministic order", () => {
  const tiles = normalizeDashboardTiles([
    { widgetId: "reading", width: "half" },
    { widgetId: "reading", width: "full" },
    { widgetId: "hero", width: "full" },
  ]);
  assert.equal(tiles[0].widgetId, "reading");
  assert.equal(tiles[1].widgetId, "hero");
  assert.ok(tiles.some((tile) => tile.widgetId === "stats"));
});

test("normalizeUserPreferences tolerates empty/none values and filters invalid custom themes", () => {
  const prefs = normalizeUserPreferences({
    activeCustomThemeId: "none",
    customThemes: [
      { id: "a", name: "Bad", lightPrimary: "red", lightForeground: "#fff", darkPrimary: "#111", darkForeground: "#eee" },
      { id: "b", name: "Good", lightPrimary: "#abc123", lightForeground: "#fefefe", darkPrimary: "#111111", darkForeground: "#eeeeee" },
    ],
  });
  assert.equal(prefs.activeCustomThemeId, null);
  assert.equal(prefs.customThemes.length, 1);
  assert.equal(prefs.customThemes[0].id, "b");
});

test("parseImportJson throws actionable messages for malformed payloads", () => {
  assert.throws(() => parseImportJson(""), {
    message: "Import failed: choose a JSON file with export data.",
  });
  assert.throws(() => parseImportJson("{nope"), {
    message: "Import failed: file is not valid JSON.",
  });
  assert.throws(() => parseImportJson(JSON.stringify({})), {
    message: "Import failed: books must be an array.",
  });
});

test("parseImportJson returns normalized preferences defaults when omitted", () => {
  const parsed = parseImportJson(
    JSON.stringify({
      books: [],
      margins: [],
      goals: [],
      settings: {
        darkMode: false,
        accentColor: "default",
        compactMode: false,
        fontScale: "md",
      },
    }),
  );
  assert.deepEqual(parsed.preferences, DEFAULT_PREFERENCES);
});


test("parseImportJson accepts legacy payloads without settings object", () => {
  const parsed = parseImportJson(JSON.stringify({ books: [], margins: [], goals: [], darkMode: true, compactMode: true, accentColor: "sage", fontScale: "lg" }));
  assert.equal(parsed.settings.darkMode, true);
  assert.equal(parsed.settings.compactMode, true);
  assert.equal(parsed.settings.accentColor, "sage");
  assert.equal(parsed.settings.fontScale, "lg");
});

test("parseImportJson accepts userSettings object fallback", () => {
  const parsed = parseImportJson(JSON.stringify({ books: [], margins: [], goals: [], userSettings: { darkMode: true, compactMode: false, accentColor: "ocean", fontScale: "sm" } }));
  assert.equal(parsed.settings.darkMode, true);
  assert.equal(parsed.settings.compactMode, false);
  assert.equal(parsed.settings.accentColor, "ocean");
  assert.equal(parsed.settings.fontScale, "sm");
});
