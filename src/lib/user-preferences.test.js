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
      {
        id: "a",
        name: "Bad",
        lightPrimary: "red",
        lightForeground: "#fff",
        darkPrimary: "#111",
        darkForeground: "#eee",
      },
      {
        id: "b",
        name: "Good",
        lightPrimary: "#abc123",
        lightForeground: "#fefefe",
        darkPrimary: "#111111",
        darkForeground: "#eeeeee",
      },
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
  const parsed = parseImportJson(
    JSON.stringify({
      books: [],
      margins: [],
      goals: [],
      darkMode: true,
      compactMode: true,
      accentColor: "sage",
      fontScale: "lg",
    }),
  );
  assert.equal(parsed.settings.darkMode, true);
  assert.equal(parsed.settings.compactMode, true);
  assert.equal(parsed.settings.accentColor, "sage");
  assert.equal(parsed.settings.fontScale, "lg");
});

test("parseImportJson accepts userSettings object fallback", () => {
  const parsed = parseImportJson(
    JSON.stringify({
      books: [],
      margins: [],
      goals: [],
      userSettings: { darkMode: true, compactMode: false, accentColor: "ocean", fontScale: "sm" },
    }),
  );
  assert.equal(parsed.settings.darkMode, true);
  assert.equal(parsed.settings.compactMode, false);
  assert.equal(parsed.settings.accentColor, "ocean");
  assert.equal(parsed.settings.fontScale, "sm");
});

test("parseImportJson rejects unsupported explicit versions and non-object roots", () => {
  for (const version of [0, 2, "1", null, {}]) {
    assert.throws(
      () => parseImportJson(JSON.stringify({ version, books: [], margins: [], goals: [] })),
      /unsupported export version/,
    );
  }
  assert.throws(() => parseImportJson("[]"), /root JSON value must be an object/);
  assert.equal(
    parseImportJson(JSON.stringify({ version: 1, books: [], margins: [], goals: [] })).version,
    1,
  );
});

test("parseImportJson preserves metadata, unknown preference fields and original export time", () => {
  const archive = {
    version: 1,
    exportedAt: "2025-06-01T12:00:00.000Z",
    books: [{ id: "book-1", metadata: { rating: 4.5, future: { values: [null, false, 0] } } }],
    margins: [{ id: "margin-1", bookId: "book-1" }],
    goals: [],
    preferences: {
      future: { enabled: true, list: [1, "a"] },
      customThemes: [
        {
          id: "theme-1",
          name: "Custom",
          lightPrimary: "#abcdef",
          lightForeground: "#ffffff",
          darkPrimary: "#123456",
          darkForeground: "#ffffff",
          future: "keep",
        },
      ],
      dashboardTiles: [{ widgetId: "hero", width: "full", future: "keep" }],
    },
  };
  const parsed = parseImportJson(JSON.stringify(archive));
  assert.deepEqual(parsed.books, archive.books);
  assert.equal(parsed.exportedAt, archive.exportedAt);
  assert.deepEqual(parsed.preferences.future, archive.preferences.future);
  assert.equal(parsed.preferences.customThemes[0].future, "keep");
  assert.equal(parsed.preferences.dashboardTiles[0].future, "keep");
  assert.deepEqual(normalizeUserPreferences(parsed.preferences), parsed.preferences);
});

test("parseImportJson rejects duplicate IDs in each collection before import", () => {
  for (const collection of ["books", "margins", "goals"]) {
    const archive = {
      books: [],
      margins: [],
      goals: [],
      [collection]: [{ id: "same" }, { id: "same" }],
    };
    assert.throws(
      () => parseImportJson(JSON.stringify(archive)),
      new RegExp(`${collection} contains duplicate id`),
    );
  }
});

test("parseImportJson rejects missing IDs and orphan margins", () => {
  assert.throws(
    () => parseImportJson(JSON.stringify({ books: [{}], margins: [], goals: [] })),
    /books\[0\] must have a non-empty string id/,
  );
  assert.throws(
    () =>
      parseImportJson(
        JSON.stringify({ books: [], margins: [{ id: "margin-1", bookId: "missing" }], goals: [] }),
      ),
    /must reference a book in this export/,
  );
});
