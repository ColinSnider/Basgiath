import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { readFile, readdir } from "node:fs/promises";
import * as legacy from "../../shared/schema.ts";
import * as schema from "../../shared/schema-v2.ts";
import { createAccountService } from "./account-service.ts";
import { createLibraryService } from "./library-service.ts";
import { importLegacyLibrary } from "./legacy-import.ts";
import { parseRowanArchive } from "../../shared/rowan-archive.ts";

const key = () => crypto.randomUUID();
test("account data operations preserve ownership, restore integrity, and mirror decisions", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  const db = drizzle(client, { schema: legacy });
  for (const f of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
    await client.exec(await readFile(`migrations/${f}`, "utf8"));
  // Follow the deployed migration journal, rather than executing every SQL file.
  await migrate(db, { migrationsFolder: "migrations-v2" });
  await migrate(db, { migrationsFolder: "migrations-v2" });
  const journal = JSON.parse(await readFile("migrations-v2/meta/_journal.json", "utf8"));
  const files = (await readdir("migrations-v2")).filter((f) => f.endsWith(".sql")).sort();
  assert.deepEqual(
    journal.entries.map((e: { tag: string }) => `${e.tag}.sql`),
    files,
  );
  const database = db as unknown as Parameters<typeof createAccountService>[0];
  const service = createAccountService(database);
  const library = createLibraryService(database, {
    async fetchWork() {
      throw new Error("unused");
    },
  });
  await db.insert(legacy.users).values([
    { id: 1, username: "one" },
    { id: 2, username: "two" },
  ]);
  const actor = { userId: 1 },
    other = { userId: 2 };
  const [sourceBook] = await db
    .insert(legacy.books)
    .values({
      id: "old",
      userId: 1,
      title: "Original",
      author: "Author",
      status: "reading",
      currentPage: 40,
      totalPages: 200,
      metadata: { rating: 4.5, tags: ["fiction"], custom: { a: [1, null] } },
    })
    .returning();
  const [sourceGoal] = await db
    .insert(legacy.goals)
    .values({ id: "source-goal", userId: 1, metric: "books", timeframe: "year", target: 10 })
    .returning();
  const [sourceSettings] = await db.insert(legacy.userSettings).values({ userId: 1 }).returning();
  const [sourceMargin] = await db
    .insert(legacy.margins)
    .values({
      id: "old-quote",
      bookId: "old",
      userId: 1,
      type: "quote",
      text: "A thought",
      page: 12,
    })
    .returning();
  const mirror = () =>
    importLegacyLibrary(
      database,
      { id: 1, username: "one", displayName: "One" },
      [sourceBook],
      [sourceMargin],
      [sourceGoal],
      sourceSettings,
    );
  await mirror();
  const [book] = await db.select().from(schema.userBooks).where(eq(schema.userBooks.userId, 1));
  await db.insert(schema.userBooks).values({ userId: 2, workId: book.workId });
  const otherBefore = JSON.parse(await library.archive(other));

  await t.test(
    "settings and personal corrections survive sync without changing another reader",
    async () => {
      const settings = { darkMode: true, compactMode: true, accentColor: "sage", fontScale: "lg" };
      await service.saveSettings(actor, key(), settings);
      await mirror();
      assert.equal((await service.settings(actor)).settings.darkMode, true);
      const input = {
        userBookId: book.id,
        expectedVersion: 0,
        title: "My title",
        authors: ["My author"],
        coverUrl: null,
        metadata: { custom: { retained: true } },
      };
      const request = key();
      await service.editBook(actor, request, input);
      await service.editBook(actor, request, input);
      await assert.rejects(service.editBook(actor, request, { ...input, title: "Different" }));
      await assert.rejects(service.editBook(other, key(), input));
      await mirror();
      assert.equal(
        (await library.libraryPage(actor, { query: "My title" })).items[0].title,
        "My title",
      );
      assert.equal((await library.home(actor)).current[0].book.title, "My title");
      assert.equal((await library.libraryPage(other, {})).items[0].title, "Original");
      await assert.rejects(
        service.deleteBook(actor, key(), { userBookId: book.id, expectedVersion: 0 }),
      );
    },
  );
  assert.equal((await library.readingHistory(actor, book.id)).halfStars, 9);
  assert.equal((await library.readingHistory(actor, book.id)).margins[0].kind, "quote");
  await t.test(
    "goal retries and edits survive the mirror, deleted goals stay deleted",
    async () => {
      const command = {
        key: key(),
        id: "source-goal",
        metric: "books" as const,
        timeframe: "year" as const,
        target: 24,
      };
      await library.saveGoal(actor, command);
      await library.saveGoal(actor, command);
      await mirror();
      assert.equal((await library.goals(actor))[0].target, 24);
      await assert.rejects(library.saveGoal(actor, { ...command, target: 25 }));
      await assert.rejects(service.deleteGoal(other, key(), "source-goal"));
      const request = key();
      await service.deleteGoal(actor, request, "source-goal");
      await service.deleteGoal(actor, request, "source-goal");
      await mirror();
      assert.equal((await library.goals(actor)).length, 0);
      await library.setAnnualGoal(actor, { key: key(), year: 2026, target: 30 });
    },
  );
  const [shelf] = await db
    .insert(schema.shelves)
    .values({ userId: 1, name: "Favorites" })
    .returning();
  await db.insert(schema.shelfItems).values({ shelfId: shelf.id, userId: 1, userBookId: book.id });
  const backup = await library.archive(actor);
  await t.test("malformed archives are rejected before data changes", async () => {
    const bad = JSON.parse(backup);
    bad.margins[0].userBookId = key();
    await assert.rejects(async () => service.restore(actor, key(), JSON.stringify(bad)));
    bad.margins[0].userBookId = book.id;
    bad.shelves[0].userId = 2;
    assert.throws(() => parseRowanArchive(JSON.stringify(bad)));
    assert.equal((await library.libraryPage(actor, {})).items.length, 1);
    await assert.rejects(
      service.deleteBook(other, key(), { userBookId: book.id, expectedVersion: 1 }),
    );
  });
  await t.test("deletion is retry safe and source sync does not resurrect it", async () => {
    const request = key();
    const input = { userBookId: book.id, expectedVersion: 1 };
    await service.deleteBook(actor, request, input);
    await service.deleteBook(actor, request, input);
    await mirror();
    assert.equal((await library.libraryPage(actor, {})).items.length, 0);
    assert.equal((await library.marginJournal(actor, { query: "", offset: 0 })).items.length, 0);
    assert.equal((await library.libraryPage(other, {})).items.length, 1);
  });
  await t.test(
    "restore remaps all relationships, preserves history and retries exactly once",
    async () => {
      const request = key();
      await service.restore(actor, request, backup);
      const first = JSON.parse(await library.archive(actor));
      const savedAgain = await library.saveWork(actor, {
        key: key(),
        ref: { provider: "legacy", externalId: "old" },
      });
      assert.equal(savedAgain.userBookId, first.userBooks[0].id);
      await service.restore(actor, request, backup);
      await mirror();
      const restored = JSON.parse(await library.archive(actor));
      assert.equal(restored.userBooks[0].id, first.userBooks[0].id);
      assert.notEqual(restored.userBooks[0].id, book.id);
      assert.equal(restored.readingSessions[0].userBookId, restored.userBooks[0].id);
      assert.equal(restored.progressEntries[0].readingSessionId, restored.readingSessions[0].id);
      assert.equal(restored.ratings[0].halfStars, 9);
      assert.equal(restored.margins[0].body, "A thought");
      assert.equal(restored.margins[0].kind, "quote");
      const oldFormat = JSON.parse(backup);
      delete oldFormat.margins[0].kind;
      oldFormat.margins[0].body = "  keep this whitespace\n";
      assert.equal(parseRowanArchive(JSON.stringify(oldFormat)).margins[0].kind, "note");
      assert.equal(
        parseRowanArchive(JSON.stringify(oldFormat)).margins[0].body,
        "  keep this whitespace\n",
      );
      assert.equal(restored.goals[0].target, 30);
      assert.equal(restored.shelfItems[0].shelfId, restored.shelves[0].id);
      assert.equal(restored.userBooks[0].legacyMetadata.custom.retained, true);
      assert.equal(
        restored.userBooks[0].legacyMetadata.archiveCatalogMappings[0].provider,
        "legacy",
      );
      parseRowanArchive(JSON.stringify(restored));
      await service.restore(actor, key(), JSON.stringify(restored));
      const twice = JSON.parse(await library.archive(actor));
      assert.equal(twice.userBooks[0].legacyMetadata.archiveCatalogMappings[0].provider, "legacy");
      assert.equal((await library.libraryPage(actor, {})).items.length, 1);
      const after = JSON.parse(await library.archive(other));
      delete after.exportedAt;
      delete otherBefore.exportedAt;
      assert.deepEqual(after, otherBefore);
    },
  );
  await t.test(
    "failed restore rolls back deletion and clear remains clear after mirror",
    async () => {
      const before = JSON.parse(await library.archive(actor));
      await client.exec(
        "CREATE FUNCTION fail_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER fail_restore BEFORE INSERT ON v2.works FOR EACH ROW EXECUTE FUNCTION fail_restore();",
      );
      await assert.rejects(service.restore(actor, key(), backup));
      assert.equal(
        JSON.parse(await library.archive(actor)).userBooks[0].id,
        before.userBooks[0].id,
      );
      await client.exec("DROP TRIGGER fail_restore ON v2.works; DROP FUNCTION fail_restore();");
      const request = key();
      await service.clear(actor, request);
      await service.clear(actor, request);
      await mirror();
      const cleared = JSON.parse(await library.archive(actor));
      for (const field of [
        "userBooks",
        "readingSessions",
        "progressEntries",
        "margins",
        "ratings",
        "shelves",
        "shelfItems",
        "goals",
        "settings",
      ])
        assert.equal(cleared[field].length, 0, field);
      assert.equal((await service.settings(actor)).mirrorPaused, true);
      assert.deepEqual((await db.select().from(legacy.books))[0], sourceBook);
    },
  );
});
