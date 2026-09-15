import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { users } from "../../shared/schema.ts";
import { createLibraryService } from "./library-service.ts";
import { createShelfService } from "./shelf-service.ts";
import { createAccountService } from "./account-service.ts";

test("shelf descriptions, ordering, restore and deletion preserve owned books", async () => {
  const client = new PGlite();
  try {
    for (const file of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
      await client.exec(await readFile(`migrations/${file}`, "utf8"));
    for (const file of (await readdir("migrations-v2")).filter((f) => f.endsWith(".sql")).sort())
      await client.exec(await readFile(`migrations-v2/${file}`, "utf8"));
    const database = drizzle(client);
    await database.insert(users).values([
      { id: 1, username: "shelves" },
      { id: 2, username: "other" },
    ]);
    const db = database as unknown as Parameters<typeof createLibraryService>[0];
    const library = createLibraryService(db, {
      fetchWork: async () => {
        throw new Error("unused");
      },
    });
    const shelves = createShelfService(db);
    const actor = { userId: 1 },
      other = { userId: 2 },
      key = () => crypto.randomUUID();
    const a = await shelves.create(actor, { key: key(), name: "A" });
    const b = await shelves.create(actor, { key: key(), name: "B" });
    await shelves.rename(actor, {
      key: key(),
      shelfId: a.shelfId,
      expectedVersion: 0,
      name: "A",
      description: "Evening reads",
    });
    await assert.rejects(
      shelves.manage(other, {
        key: key(),
        shelfId: a.shelfId,
        expectedVersion: 1,
        action: "delete",
      }),
      /not found/i,
    );
    await assert.rejects(
      shelves.manage(actor, { key: key(), shelfId: a.shelfId, expectedVersion: 0, action: "down" }),
      /changed/i,
    );
    const move = { key: key(), shelfId: a.shelfId, expectedVersion: 1, action: "down" as const };
    await shelves.manage(actor, move);
    await shelves.manage(actor, move);
    assert.deepEqual(
      (await shelves.list(actor)).map((s) => s.name),
      ["B", "A"],
    );
    const books = [];
    for (const title of ["First", "Second"])
      books.push(
        await library.saveManual(actor, {
          key: key(),
          title,
          author: "Reader",
          format: "book",
          total: 100,
        }),
      );
    const browsing = await library.libraryPage(actor, {});
    assert.equal(browsing.items.length, 2);
    assert.equal(browsing.items[0].hasRead, false);
    assert.deepEqual(browsing.items[0].readYears, []);
    assert.equal(browsing.items[0].lastFinishedAt, null);
    assert.ok(browsing.items[0].addedAt);
    let version = (await shelves.list(actor)).find((s) => s.id === a.shelfId)!.version;
    for (const book of books)
      await shelves.setItem(actor, {
        key: key(),
        shelfId: a.shelfId,
        userBookId: book.userBookId,
        expectedVersion: version++,
        present: true,
      });
    await shelves.manage(actor, {
      key: key(),
      shelfId: a.shelfId,
      userBookId: books[1].userBookId,
      expectedVersion: version++,
      action: "up",
    });
    const raw = await library.archive(actor);
    const archive = JSON.parse(raw);
    assert.equal(archive.version, 6);
    assert.equal(
      archive.shelves.find((s: { id: string }) => s.id === a.shelfId).description,
      "Evening reads",
    );
    assert.equal(
      archive.shelfItems.sort(
        (a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder,
      )[0].userBookId,
      books[1].userBookId,
    );
    await createAccountService(db).restore(other, key(), raw);
    assert.deepEqual(
      (await shelves.list(other)).map((s) => s.name),
      ["B", "A"],
    );
    assert.equal((await shelves.list(other))[1].description, "Evening reads");
    const remove = {
      key: key(),
      shelfId: a.shelfId,
      expectedVersion: version,
      action: "delete" as const,
    };
    await shelves.manage(actor, remove);
    await shelves.manage(actor, remove);
    assert.equal((await library.listLibrary(actor)).length, 2);
    assert.equal((await shelves.membership(actor, books[0].userBookId)).length, 0);
    assert.equal((await shelves.list(actor))[0].id, b.shelfId);
    assert.equal((await shelves.list(other)).length, 2);
  } finally {
    await client.close();
  }
});
