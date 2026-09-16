import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { users, goals } from "../../shared/schema.ts";
import * as schema from "../../shared/schema-v2.ts";
import { createLibraryService } from "./library-service.ts";

test("paged browsing filters the whole library, isolates owners, and shares local year boundaries with insights", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  for (const file of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
    await client.exec(await readFile(new URL(`../../migrations/${file}`, import.meta.url), "utf8"));
  for (const file of (await readdir(new URL("../../migrations-v2/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(
      await readFile(new URL(`../../migrations-v2/${file}`, import.meta.url), "utf8"),
    );
  const db = drizzle(client, { schema });
  await db.insert(users).values([
    { id: 1, username: "reader" },
    { id: 2, username: "other" },
  ]);
  const works = Array.from({ length: 1000 }, (_, index) => ({
    id: crypto.randomUUID(),
    title: `Book ${String(index).padStart(4, "0")}`,
    authors: [index === 999 ? "Last Author" : "Author"],
  }));
  await db.insert(schema.works).values(works);
  const books = works.map((work) => ({ id: crypto.randomUUID(), userId: 1, workId: work.id }));
  await db.insert(schema.userBooks).values(books);
  await db.insert(schema.userBooks).values({ userId: 2, workId: works[999].id });
  const service = createLibraryService(
    db as unknown as Parameters<typeof createLibraryService>[0],
    {
      fetchWork: async () => {
        throw new Error("Provider must not be used");
      },
    },
  );
  const first = await service.libraryPage({ userId: 1 }, { sort: "title" });
  assert.equal(first.total, 1000);
  assert.equal(first.items.length, 24);
  assert.equal(first.nextOffset, 24);
  const second = await service.libraryPage({ userId: 1 }, { sort: "title", offset: 24 });
  assert.equal(second.items[0].title, "Book 0024");
  assert.equal(second.total, 1000);
  assert.ok(second.items.every((book) => !first.items.some((earlier) => earlier.id === book.id)));
  const pastLast = await service.libraryPage({ userId: 1 }, { offset: 1008 });
  assert.equal(pastLast.total, 1000);
  assert.deepEqual(pastLast.items, []);
  const filteredPastLast = await service.libraryPage(
    { userId: 1 },
    { author: "Last Author", offset: 24 },
  );
  assert.equal(filteredPastLast.total, 1);
  const last = await service.libraryPage({ userId: 1 }, { author: "Last Author" });
  assert.equal(last.total, 1);
  assert.equal(last.items[0].id, books[999].id);
  assert.equal((await service.libraryPage({ userId: 2 }, {})).total, 1);
  const shelfId = crypto.randomUUID();
  await db.insert(schema.shelves).values({ id: shelfId, userId: 1, name: "Reverse order" });
  await db.insert(schema.shelfItems).values([
    { shelfId, userId: 1, userBookId: books[999].id, sortOrder: 0 },
    { shelfId, userId: 1, userBookId: books[0].id, sortOrder: 1 },
  ]);
  const shelf = await service.libraryPage({ userId: 1 }, { shelfId, sort: "shelf" });
  assert.equal(shelf.total, 2);
  assert.deepEqual(
    shelf.items.map((b) => b.id),
    [books[999].id, books[0].id],
  );
  assert.equal((await service.libraryPage({ userId: 2 }, { shelfId })).total, 0);
  // Opening a collection must include both members, even on opposite ends of
  // the globally paginated library; never intersect with its first 24 books.
  const collection = await service.libraryPage(
    { userId: 1 },
    { collection: "shelf", collectionId: shelfId, shelfId },
  );
  assert.equal(collection.total, 2);
  assert.equal(collection.items.length, 2);
  await db.insert(schema.readingQueue).values([
    { userId: 1, userBookId: books[999].id, sortOrder: 5, pinned: true },
    { userId: 1, userBookId: books[0].id, sortOrder: 0, pinned: false },
  ]);
  assert.deepEqual(
    (await service.libraryPage({ userId: 1 }, { collection: "queue", sort: "shelf" })).items.map(
      (b) => b.id,
    ),
    [books[999].id, books[0].id],
  );
  await db.insert(schema.readingSessions).values({
    userBookId: books[999].id,
    workId: works[999].id,
    state: "completed",
    unit: "page",
    total: 450,
    finishedAt: new Date("2026-01-01T02:00:00Z"),
  });
  const input = { year: "2025", timeZone: "America/Chicago" };
  assert.equal((await service.libraryPage({ userId: 1 }, input)).total, 1);
  assert.equal((await service.libraryPage({ userId: 1 }, { ...input, year: "2026" })).total, 0);
  const insight = await service.insights({ userId: 1 }, 2025, input.timeZone);
  assert.equal(insight.months[11], 1);
  assert.equal(insight.longestFinished?.total, 450);
  assert.equal(insight.recentFinishes[0].userBookId, books[999].id);
  assert.deepEqual(insight.authorsRead, [{ name: "Last Author", books: 1 }]);
  const privateInsight = await service.insights({ userId: 2 }, 2025, input.timeZone);
  assert.equal(privateInsight.longestFinished, null);
  assert.deepEqual(privateInsight.recentFinishes, []);
  const facets = await service.browseFacets({ userId: 1 }, input.timeZone);
  assert.ok(facets.authors.includes("Last Author"));
  assert.deepEqual(facets.years, ["2025"]);
  await db.insert(goals).values([
    { id: crypto.randomUUID(), userId: 1, metric: "pages", target: 500, timeframe: "2025" },
    { id: crypto.randomUUID(), userId: 2, metric: "books", target: 12, timeframe: "2025" },
  ]);
  const date = new Date("2026-01-02T12:00:00Z");
  const mine = await service.goals({ userId: 1 }, "America/Chicago", date);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].progress.current, 450);
  assert.equal(mine[0].progress.contributions[0].userBookId, books[999].id);
  const other = await service.goals({ userId: 2 }, "America/Chicago", date);
  assert.equal(other.length, 1);
  assert.equal(other[0].progress.current, 0);
  assert.deepEqual(other[0].progress.contributions, []);
  await db.insert(schema.readingSessions).values({
    userBookId: books[999].id,
    workId: works[999].id,
    state: "completed",
    unit: "page",
    total: 400,
    finishedAt: null,
  });
  const allTime = await service.insights({ userId: 1 }, null, input.timeZone);
  assert.equal(allTime.finishedReads, 2);
  assert.equal(allTime.uniqueWorks, 1);
  assert.equal(allTime.rereads, 1);
  assert.equal(allTime.undatedInPeriod, 1);
  assert.equal(
    allTime.months.reduce((sum, count) => sum + count, 0),
    1,
  );
  assert.equal(allTime.recentFinishes.length, 1);
  assert.equal((await service.insights({ userId: 2 }, null)).finishedReads, 0);

  const noteId = crypto.randomUUID(),
    quoteId = crypto.randomUUID();
  await db.insert(schema.margins).values([
    {
      id: noteId,
      userBookId: books[999].id,
      kind: "note",
      body: "Private note",
      createdAt: new Date("2026-01-03T00:00:00Z"),
    },
    {
      id: quoteId,
      userBookId: books[999].id,
      kind: "quote",
      body: "Private quote",
      createdAt: new Date("2026-01-04T00:00:00Z"),
    },
    {
      id: crypto.randomUUID(),
      userBookId: books[999].id,
      body: "Deleted note",
      createdAt: new Date("2026-01-03T00:00:00Z"),
      deletedAt: new Date("2026-01-04T00:00:00Z"),
    },
    {
      id: crypto.randomUUID(),
      userBookId: books[999].id,
      body: "Outside range",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    },
  ]);
  const range = { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" };
  const diary = await service.calendar({ userId: 1 }, range);
  assert.deepEqual(
    diary.events
      .filter((event) => event.kind === "note" || event.kind === "quote")
      .map((event) => event.id),
    [`margin:${noteId}`, `margin:${quoteId}`],
  );
  assert.ok(!JSON.stringify(diary).includes("Private note"));
  assert.deepEqual((await service.calendar({ userId: 2 }, range)).events, []);
});
