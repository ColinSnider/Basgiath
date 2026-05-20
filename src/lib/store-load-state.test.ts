import test from "node:test";
import assert from "node:assert/strict";
import { mergeLoadedStoreState } from "./store-load-state.ts";

test("mergeLoadedStoreState preserves preferences during reload", () => {
  const previousState = {
    books: [],
    margins: [],
    goals: [],
    settings: {
      darkMode: false,
      accentColor: "default",
      compactMode: false,
      fontScale: "md",
    },
    preferences: {
      dashboardTiles: [
        { widgetId: "hero", width: "full" },
        { widgetId: "stats", width: "half" },
      ],
    },
    dataLoading: true,
  };

  const nextState = mergeLoadedStoreState({
    previousState,
    loadedData: {
      books: [{ id: "book-1" }],
      margins: [{ id: "margin-1" }],
      goals: [{ id: "goal-1" }],
      settings: {
        darkMode: true,
        accentColor: "sage",
        compactMode: true,
      },
    },
    mapBook: (row) => row,
    mapMargin: (row) => row,
    mapGoal: (row) => row,
  });

  assert.equal(nextState.preferences, previousState.preferences);
  assert.deepEqual(nextState.books, [{ id: "book-1" }]);
  assert.deepEqual(nextState.margins, [{ id: "margin-1" }]);
  assert.deepEqual(nextState.goals, [{ id: "goal-1" }]);
  assert.equal(nextState.settings.darkMode, true);
  assert.equal(nextState.settings.accentColor, "sage");
  assert.equal(nextState.settings.compactMode, true);
  assert.equal(nextState.settings.fontScale, "md");
  assert.equal(nextState.dataLoading, false);
});
