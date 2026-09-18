import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { users } from "../../shared/schema.ts";
import { createLibraryService } from "./library-service.ts";
import { createAccountService } from "./account-service.ts";
test("catalog refresh updates the personal record, preserves editions/history, and retries offline", async () => {
  const client = new PGlite();
  try {
    for (const file of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
      await client.exec(await readFile(`migrations/${file}`, "utf8"));
    for (const file of (await readdir("migrations-v2")).filter((f) => f.endsWith(".sql")).sort())
      await client.exec(await readFile(`migrations-v2/${file}`, "utf8"));
    const database = drizzle(client);
    await database.insert(users).values([
      { id: 1, username: "reader" },
      { id: 2, username: "other" },
    ]);
    const db = database as unknown as Parameters<typeof createLibraryService>[0];
    let requests = 0;
    const library = createLibraryService(db, {
      fetchWork: async () => {
        requests++;
        if (requests > 1) throw new Error("offline");
        return {
          title: "Refreshed title",
          authors: ["Author"],
          coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
          description: "Full synopsis",
          edition: {
            externalId: "volume",
            format: "book",
            pageCount: 999,
            durationSeconds: null,
            language: "en",
          },
        };
      },
    });
    const actor = { userId: 1 },
      key = () => crypto.randomUUID();
    const saved = await library.saveManual(actor, {
      key: key(),
      title: "Imported title",
      author: "Old author",
      format: "book",
      total: 333,
    });
    await library.startReading(actor, {
      key: key(),
      userBookId: saved.userBookId,
      expectedVersion: 0,
      startedAt: null,
      unit: "page",
    });
    const before = await library.readingHistory(actor, saved.userBookId);
    const input = {
      key: key(),
      userBookId: saved.userBookId,
      expectedVersion: before.userBookVersion,
      source: "googlebooks" as const,
      externalId: "volume",
    };
    await assert.rejects(library.syncCatalog({ userId: 2 }, input), /not found/i);
    assert.equal(requests, 0);
    await library.syncCatalog(actor, input);
    await library.syncCatalog(actor, input);
    assert.equal(requests, 1);
    const after = await library.readingHistory(actor, saved.userBookId);
    assert.deepEqual(after.sessions, before.sessions);
    assert.deepEqual(after.entries, before.entries);
    assert.deepEqual(after.edition, before.edition);
    assert.equal(after.metadata.description, "Full synopsis");
    assert.equal(
      (await library.libraryPage(actor, { userBookId: saved.userBookId })).items[0].title,
      "Refreshed title",
    );
    const archive = JSON.parse(await library.archive(actor));
    assert.equal(archive.works[0].title, "Imported title");
    await assert.rejects(library.syncCatalog(actor, { ...input, key: key() }), /changed/i);
    const account = createAccountService(db);
    await account.saveSettings(actor, key(), {
      darkMode: true,
      blackBackground: true,
      accentColor: "default",
      compactMode: false,
      fontScale: "md",
    });
    assert.equal((await account.settings(actor)).settings.blackBackground, true);
    const raw = await library.archive(actor);
    await account.restore({ userId: 2 }, key(), raw);
    assert.equal((await account.settings({ userId: 2 })).settings.blackBackground, true);
  } finally {
    await client.close();
  }
});
