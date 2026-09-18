import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as legacy from "../../shared/schema.ts";
import * as rowan from "../../shared/schema-v2.ts";
import { createUserDataService } from "../user-data-service.ts";
import { importLegacyLibrary } from "./legacy-import.ts";

test("a shared Basgiath export produces independent Rowan libraries and retries without duplicates", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  const db = drizzle(client, { schema: legacy });
  for (const file of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
    await client.exec(await readFile(`migrations/${file}`, "utf8"));
  await migrate(db, { migrationsFolder: "migrations-v2" });
  const database = db as unknown as Parameters<typeof createUserDataService>[0];
  const service = createUserDataService(database);
  const accounts = await db
    .insert(legacy.users)
    .values([
      { id: 1, username: "source" },
      { id: 2, username: "fresh" },
    ])
    .returning();
  const date = "2026-09-01T12:00:00.000Z";
  await service.importUserData(1, {
    books: [
      {
        id: "shared-book",
        title: "A book",
        author: "A reader",
        format: "book",
        status: "finished",
        totalPages: 300,
        addedAt: date,
        reads: [{ finishedAt: date }],
      },
    ],
    margins: [
      {
        id: "shared-margin",
        bookId: "shared-book",
        type: "note",
        text: "Remember this",
        createdAt: date,
      },
    ],
    goals: [{ id: "shared-goal", metric: "books", target: 12, timeframe: "year", createdAt: date }],
    settings: { darkMode: true, accentColor: "sage", compactMode: false, fontScale: "md" },
  });
  const source = await service.exportUserData(1);
  const archive = JSON.parse(JSON.stringify(source));
  async function translate(userId: number) {
    const data = await service.exportUserData(userId);
    await importLegacyLibrary(
      database,
      accounts.find((a) => a.id === userId)!,
      data.books,
      data.margins,
      data.goals,
      data.settings,
      true,
      true,
    );
  }
  await translate(1);
  await service.importUserData(2, archive);
  await translate(2);
  const before = await db.select().from(rowan.userBooks);
  assert.equal(before.length, 2);
  assert.notEqual(before[0].workId, before[1].workId);
  const freshBook = before.find((book) => book.userId === 2)!;
  const notes = await db
    .select()
    .from(rowan.margins)
    .where(eq(rowan.margins.userBookId, freshBook.id));
  assert.equal(notes.length, 1);
  assert.equal(notes[0].userBookId, freshBook.id);
  assert.equal(notes[0].body, "Remember this");
  const sessions = await db
    .select()
    .from(rowan.readingSessions)
    .where(eq(rowan.readingSessions.userBookId, freshBook.id));
  assert.equal(sessions.length, 1);
  await service.importUserData(2, archive);
  await translate(2);
  assert.deepEqual(await db.select().from(rowan.userBooks), before);
  assert.deepEqual(
    await db.select().from(rowan.margins).where(eq(rowan.margins.userBookId, freshBook.id)),
    notes,
  );
  assert.deepEqual(
    await db
      .select()
      .from(rowan.readingSessions)
      .where(eq(rowan.readingSessions.userBookId, freshBook.id)),
    sessions,
  );
  assert.deepEqual(await service.exportUserData(1), source);
});
