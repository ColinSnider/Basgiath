import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema.ts";
import { createUserDataService } from "./user-data-service.ts";
import { importDataSchema } from "../src/lib/import-contract.ts";

const date = "2025-02-03T12:34:56.000Z";
const metadata = {
  rating: 4.5,
  tags: ["Fantasy", "日本語"],
  unknown: { nested: [null, false, 0, { source: "OL123W" }] },
};
function archive() {
  return {
    books: [
      {
        id: "restored",
        title: "A book",
        author: "Someone",
        status: "finished",
        addedAt: date,
        reads: [{ finishedAt: date }, { finishedAt: date }],
        metadata,
      },
    ],
    margins: [
      {
        id: "restored-note",
        bookId: "restored",
        type: "quote",
        text: "Exact text\n— 日本語",
        page: 0,
        createdAt: date,
      },
    ],
    goals: [
      { id: "restored-goal", metric: "books", target: 12, timeframe: "year", createdAt: date },
    ],
    settings: { darkMode: true, accentColor: "sage", compactMode: false, fontScale: "lg" },
  };
}

test("personal-data operations preserve data and isolate owners on PostgreSQL", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  await client.exec(
    await readFile(new URL("../migrations/0000_initial_schema.sql", import.meta.url), "utf8"),
  );
  await client.exec(
    await readFile(new URL("../migrations/0002_book_metadata.sql", import.meta.url), "utf8"),
  );
  const database = drizzle(client, { schema });
  // Both Drizzle adapters execute the same PostgreSQL query builders and transactions.
  const service = createUserDataService(
    database as unknown as Parameters<typeof createUserDataService>[0],
  );
  await database.insert(schema.users).values([
    { id: 1, username: "owner" },
    { id: 2, username: "other" },
  ]);
  await database
    .insert(schema.books)
    .values({ id: "other-book", userId: 2, title: "Private", author: "Other" });
  await database
    .insert(schema.margins)
    .values({ id: "other-note", userId: 2, bookId: "other-book", type: "note", text: "Private" });
  await database
    .insert(schema.goals)
    .values({ id: "other-goal", userId: 2, metric: "books", target: 3, timeframe: "year" });

  await t.test("foreign resource IDs cannot mutate data or accept margins", async () => {
    await assert.rejects(
      service.updateBook(1, "other-book", { title: "Changed" }),
      /Record not found/,
    );
    await assert.rejects(service.removeBook(1, "other-book"), /Record not found/);
    await assert.rejects(service.removeMargin(1, "other-note"), /Record not found/);
    await assert.rejects(service.removeGoal(1, "other-goal"), /Record not found/);
    await assert.rejects(
      service.addMargin(1, { bookId: "other-book", type: "note", text: "Attack" }),
      /Record not found/,
    );
    assert.equal((await database.select().from(schema.books))[0].title, "Private");
    assert.equal((await database.select().from(schema.margins)).length, 1);
  });

  await t.test(
    "import retains nested metadata, rereads, exact margins and creates missing settings",
    async () => {
      await service.importUserData(1, archive());
      const [book] = await database.select().from(schema.books).where(eq(schema.books.userId, 1));
      assert.deepEqual(book.metadata, metadata);
      assert.deepEqual(book.reads, archive().books[0].reads);
      const [margin] = await database
        .select()
        .from(schema.margins)
        .where(eq(schema.margins.userId, 1));
      assert.equal(margin.text, archive().margins[0].text);
      assert.equal(margin.page, 0);
      assert.equal(margin.createdAt.toISOString(), date);
      assert.deepEqual((await database.select().from(schema.userSettings))[0], {
        userId: 1,
        ...archive().settings,
      });
      const legacy = archive();
      delete (legacy.books[0] as { metadata?: unknown }).metadata;
      assert.deepEqual(importDataSchema.parse(legacy).books[0].metadata, {});
    },
  );

  await t.test("duplicate IDs and missing references reject before replacement", async () => {
    for (const collection of ["books", "margins", "goals"] as const) {
      const input = archive();
      input[collection] = [...input[collection], input[collection][0]] as never;
      await assert.rejects(service.importUserData(1, input), /Duplicate import ID/);
    }
    const missing = archive();
    missing.margins[0].bookId = "absent";
    await assert.rejects(service.importUserData(1, missing), /missing book/);
    assert.deepEqual(
      (await database.select().from(schema.books).where(eq(schema.books.userId, 1)))[0].metadata,
      metadata,
    );
  });

  await t.test("SQL failure after deletion rolls back all replaced data", async () => {
    const before = await database.select().from(schema.books);
    const beforeMargins = await database.select().from(schema.margins);
    const input = archive();
    await client.exec(`CREATE FUNCTION fail_import_goal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
      CREATE TRIGGER fail_import BEFORE INSERT ON goals FOR EACH ROW EXECUTE FUNCTION fail_import_goal();`);
    await assert.rejects(service.importUserData(1, input));
    await client.exec("DROP TRIGGER fail_import ON goals; DROP FUNCTION fail_import_goal();");
    assert.deepEqual(await database.select().from(schema.books), before);
    assert.deepEqual(await database.select().from(schema.margins), beforeMargins);
  });

  await t.test("settings patches create missing rows and retain unspecified values", async () => {
    await service.updateSettings(2, { darkMode: true });
    await service.updateSettings(2, { accentColor: "violet" });
    const [settings] = await database
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, 2));
    assert.equal(settings.darkMode, true);
    assert.equal(settings.accentColor, "violet");
    await service.updateSettings(2, {});
  });

  await t.test(
    "finish retries append once, rereads append again, and ownership is enforced",
    async () => {
      await database.insert(schema.books).values({
        id: "audio",
        userId: 1,
        title: "Audio",
        author: "A",
        format: "audiobook",
        durationMinutes: 90,
        currentMinute: 12,
      });
      await assert.rejects(service.finishRead(2, "audio", date), /Record not found/);
      await Promise.all([
        service.finishRead(1, "audio", date),
        service.finishRead(1, "audio", date),
      ]);
      let [audio] = await database.select().from(schema.books).where(eq(schema.books.id, "audio"));
      assert.equal(audio.reads.length, 1);
      assert.equal(audio.currentMinute, 90);
      await service.updateBook(1, "audio", { status: "reading" });
      await service.finishRead(1, "audio", date);
      [audio] = await database.select().from(schema.books).where(eq(schema.books.id, "audio"));
      assert.equal(audio.reads.length, 2);
      await service.removeBook(1, "audio");
      await database.insert(schema.books).values({
        id: "missing-history",
        userId: 1,
        title: "Legacy",
        author: "A",
        status: "finished",
        totalPages: 123,
      });
      await service.finishRead(1, "missing-history", date);
      const repaired = await service.finishRead(1, "missing-history", date);
      assert.equal(repaired.reads.length, 1);
      assert.equal(repaired.currentPage, 123);
      await service.removeBook(1, "missing-history");
    },
  );

  await t.test("exports contain only the owner snapshot without account credentials", async () => {
    const snapshot = await service.exportUserData(1);
    assert.equal(snapshot.books.length, 1);
    assert.equal(snapshot.margins[0].bookId, snapshot.books[0].id);
    assert.deepEqual(Object.keys(snapshot).sort(), ["books", "goals", "margins", "settings"]);
    assert.deepEqual(snapshot.books[0].metadata, metadata);
  });

  await t.test(
    "an existing account export imports into a fresh account with stable, independent IDs",
    async () => {
      await database.insert(schema.users).values({ id: 3, username: "fresh" });
      const source = await service.exportUserData(1);
      // Reproduce the old insert's global primary-key collision before importing.
      await assert.rejects(
        database.insert(schema.books).values({ ...source.books[0], userId: 3 }),
        (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === "23505",
      );
      const sourceJson = JSON.parse(JSON.stringify(source));
      await service.importUserData(3, sourceJson);
      const imported = await service.exportUserData(3);
      assert.notEqual(imported.books[0].id, source.books[0].id);
      assert.notEqual(imported.margins[0].id, source.margins[0].id);
      assert.notEqual(imported.goals[0].id, source.goals[0].id);
      assert.equal(imported.margins[0].bookId, imported.books[0].id);
      assert.deepEqual(imported.books[0].reads, source.books[0].reads);
      assert.deepEqual(imported.books[0].metadata, source.books[0].metadata);
      assert.equal(imported.margins[0].text, source.margins[0].text);
      await service.importUserData(3, sourceJson);
      assert.deepEqual(await service.exportUserData(3), imported);
      await service.importUserData(3, JSON.parse(JSON.stringify(imported)));
      assert.deepEqual(await service.exportUserData(3), imported);
      assert.deepEqual(await service.exportUserData(1), source);
      await service.clearAllData(3);
    },
  );

  await t.test("clear is atomic under database failure and affects only its owner", async () => {
    await client.exec(`CREATE FUNCTION fail_delete_book() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
      CREATE TRIGGER fail_delete BEFORE DELETE ON books FOR EACH ROW EXECUTE FUNCTION fail_delete_book();`);
    await assert.rejects(service.clearAllData(1));
    assert.equal(
      (await database.select().from(schema.margins).where(eq(schema.margins.userId, 1))).length,
      1,
    );
    assert.equal(
      (await database.select().from(schema.goals).where(eq(schema.goals.userId, 1))).length,
      1,
    );
    await client.exec("DROP TRIGGER fail_delete ON books; DROP FUNCTION fail_delete_book();");
    await service.clearAllData(1);
    assert.equal((await database.select().from(schema.books)).length, 1);
    assert.equal((await database.select().from(schema.margins))[0].id, "other-note");
    assert.equal((await database.select().from(schema.goals))[0].id, "other-goal");
  });
});
