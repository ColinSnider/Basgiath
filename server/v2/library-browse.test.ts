import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { users } from "../../shared/schema.ts";
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
  assert.deepEqual(shelf.items.map((b) => b.id), [books[999].id, books[0].id]);
  assert.equal((await service.libraryPage({ userId: 2 }, { shelfId })).total, 0);
  await db.insert(schema.readingQueue).values([
    { userId: 1, userBookId: books[999].id, sortOrder: 5, pinned: true },
    { userId: 1, userBookId: books[0].id, sortOrder: 0, pinned: false },
  ]);
  assert.deepEqual((await service.libraryPage({ userId: 1 }, { collection: "queue", sort: "shelf" })).items.map((b) => b.id), [books[999].id, books[0].id]);
  await db
    .insert(schema.readingSessions)
    .values({
      userBookId: books[999].id,
      workId: works[999].id,
      state: "completed",
      unit: "page",
      finishedAt: new Date("2026-01-01T02:00:00Z"),
    });
  const input = { year: "2025", timeZone: "America/Chicago" };
  assert.equal((await service.libraryPage({ userId: 1 }, input)).total, 1);
  assert.equal((await service.libraryPage({ userId: 1 }, { ...input, year: "2026" })).total, 0);
  assert.equal((await service.insights({ userId: 1 }, 2025, input.timeZone)).months[11], 1);
  const facets = await service.browseFacets({ userId: 1 }, input.timeZone);
  assert.ok(facets.authors.includes("Last Author"));
  assert.deepEqual(facets.years, ["2025"]);
});
