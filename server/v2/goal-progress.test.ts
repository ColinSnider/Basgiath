import assert from "node:assert/strict";
import test from "node:test";
import { goalProgress } from "../../shared/goal-progress.ts";

const read = (finishedAt: string | null, unit = "page", total: number | null = 300) => ({
  userBookId: "book-1",
  title: "A book",
  finishedAt: finishedAt ? new Date(finishedAt) : null,
  unit,
  total,
});

test("goals use local completion dates, count rereads, and disclose missing history", () => {
  const reads = [read("2026-01-01T02:00:00Z"), read("2025-08-01T12:00:00Z"), read(null)];
  const goal = { metric: "books", timeframe: "2025", target: 2 };
  const local = goalProgress(goal, reads, "America/Chicago", new Date("2026-01-02T12:00:00Z"));
  assert.equal(local.current, 2);
  assert.equal(local.achieved, true);
  assert.equal(local.undated, 1);
  assert.equal(local.ended, true);
  assert.equal(local.daysRemaining, 0);
  assert.equal(goalProgress(goal, reads, "UTC", new Date("2026-01-02T12:00:00Z")).current, 1);
});

test("page and audiobook goals use finished attempt lengths and preserve legacy hour targets", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const reads = [
    read("2026-09-14T12:00:00Z"),
    read("2026-09-15T12:00:00Z", "page", null),
    read("2026-09-15T12:00:00Z", "second", 5400),
    read("2026-09-17T12:00:00Z"),
  ];
  const pages = goalProgress(
    { metric: "pages", target: 500, timeframe: "month" },
    reads,
    "UTC",
    now,
  );
  assert.equal(pages.current, 300);
  assert.equal(pages.remaining, 200);
  assert.equal(pages.missingLength, 1);
  assert.equal(pages.percent, 60);
  const audio = goalProgress(
    { metric: "minutes", target: 2, timeframe: "month" },
    reads,
    "UTC",
    now,
  );
  assert.equal(audio.current, 1.5);
  assert.equal(audio.remaining, 0.5);
  assert.equal(audio.contributions.length, 1);
});

test("recurring weeks preserve Sunday start across DST and future years stay empty", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  const reads = [read("2026-03-08T05:59:59Z"), read("2026-03-08T06:00:00Z")];
  const weekly = goalProgress(
    { metric: "books", target: 1, timeframe: "week" },
    reads,
    "America/Chicago",
    now,
  );
  assert.equal(weekly.start, "2026-03-08");
  assert.equal(weekly.end, "2026-03-14");
  assert.equal(weekly.current, 1);
  assert.equal(weekly.daysRemaining, 5);
  const future = goalProgress(
    { metric: "books", target: 1, timeframe: "2028" },
    reads,
    "America/Chicago",
    now,
  );
  assert.equal(future.upcoming, true);
  assert.equal(future.current, 0);
  assert.equal(future.daysRemaining, 366);
});

test("flexible goals count unique books, authors, and timed activity separately", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const finished = { ...read("2026-09-14T12:00:00Z"), authors: ["Author One"] };
  const active = {
    ...read(null),
    userBookId: "book-2",
    state: "active",
    timedReads: [
      { startedAt: "2026-09-15T10:00:00Z", endedAt: "2026-09-15T10:30:00Z", seconds: 1800 },
      { startedAt: "2026-09-15T11:00:00Z", endedAt: "2026-09-15T11:30:00Z", seconds: 1800 },
    ],
  };
  const progress = (metric: string) =>
    goalProgress(
      { metric, timeframe: "month", target: 100 },
      [finished, finished, active],
      "UTC",
      now,
    );
  assert.equal(progress("books").current, 2);
  assert.equal(progress("unique_books").current, 1);
  assert.equal(progress("authors").current, 1);
  assert.equal(progress("reading_minutes").current, 60);
  assert.equal(progress("reading_days").current, 1);
  assert.equal(progress("reading_minutes").undated, 0);
});

test("custom progress honors dates and corrections, with daily and no-deadline periods", () => {
  const details = {
    title: "Try new genres",
    unit: "genres",
    entries: [
      { id: crypto.randomUUID(), date: "2026-09-15", amount: 3, note: "First genres" },
      { id: crypto.randomUUID(), date: "2026-09-16", amount: -1, note: "Correction" },
      { id: crypto.randomUUID(), date: "2026-09-17", amount: 20, note: "Future" },
    ],
  };
  const now = new Date("2026-09-16T12:00:00Z");
  const goal = { metric: "custom", timeframe: "all_time", target: 10, details };
  assert.equal(goalProgress(goal, [], "UTC", now).current, 2);
  assert.equal(goalProgress(goal, [], "UTC", now).unlimited, true);
  assert.equal(goalProgress({ ...goal, timeframe: "day" }, [], "UTC", now).current, 0);
});
