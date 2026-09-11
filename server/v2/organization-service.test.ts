import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../../shared/schema.ts";
import * as v2 from "../../shared/schema-v2.ts";
import { createOrganizationService } from "./organization-service.ts";
import { createLibraryService } from "./library-service.ts";
import { createAccountService } from "./account-service.ts";
import { importLegacyLibrary } from "./legacy-import.ts";
import { parseRowanArchive } from "../../shared/rowan-archive.ts";
import type { OrganizationAction } from "../../shared/reading-organization.ts";

test("series, queue, archives, and first-open translation preserve both readers", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  for (const f of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
    await client.exec(await readFile(`migrations/${f}`, "utf8"));
  for (const f of (await readdir("migrations-v2")).filter((f) => f.endsWith(".sql")).sort())
    await client.exec(await readFile(`migrations-v2/${f}`, "utf8"));
  const pg = drizzle(client, { schema });
  const db = pg as unknown as Parameters<typeof createOrganizationService>[0];
  const service = createOrganizationService(db);
  const library = createLibraryService(db, {
    async fetchWork() {
      throw new Error("unused");
    },
  });
  const account = createAccountService(db);
  const one = { userId: 1 },
    two = { userId: 2 };
  await pg.insert(schema.users).values([
    { id: 1, username: "one" },
    { id: 2, username: "two" },
  ]);
  const [first] = await pg
    .insert(schema.books)
    .values({
      id: "old-one",
      userId: 1,
      title: "Original book",
      status: "read",
      reads: [{ finishedAt: "2026-09-01T12:00:00.000Z" }],
      author: "Writer",
      metadata: { favorite: true, rating: 4.5 },
    })
    .returning();
  await importLegacyLibrary(
    db,
    { id: 1, username: "one", displayName: "Reader" },
    [first],
    [],
    [],
    undefined,
    true,
  );
  const original = (await service.read(one)).books[0];
  assert.equal(original.title, "Original book");
  await importLegacyLibrary(
    db,
    { id: 1, username: "one", displayName: "Reader" },
    [{ ...first, title: "Stale legacy title" }],
    [],
    [],
    undefined,
    true,
  );
  assert.equal((await service.read(one)).books[0].title, "Original book");
  assert.equal((await library.readingHistory(one, original.id)).halfStars, 9);
  const second = await library.saveManual(one, {
    key: crypto.randomUUID(),
    title: "Second book",
    author: "Writer",
    format: "book",
    total: 200,
  });
  const foreign = await library.saveManual(two, {
    key: crypto.randomUUID(),
    title: "Private book",
    author: "Other",
    format: "book",
    total: 200,
  });
  const seriesId = crypto.randomUUID();
  async function change(change: OrganizationAction) {
    await service.change(one, {
      key: crypto.randomUUID(),
      expectedVersion: (await service.read(one)).version,
      change,
    });
  }
  await change({
    action: "seriesSave",
    seriesId,
    name: "A trilogy",
    completionState: "unknown",
    sourceNote: "Publication order",
  });
  await change({
    action: "seriesBook",
    seriesId,
    userBookId: original.id,
    sequenceLabel: "1",
    optional: false,
  });
  await change({
    action: "seriesBook",
    seriesId,
    userBookId: second.userBookId,
    sequenceLabel: "2.5",
    optional: true,
  });
  await change({ action: "seriesMove", seriesId, userBookId: second.userBookId, direction: "up" });
  assert.equal((await service.read(one)).members[0].userBookId, second.userBookId);
  await change({
    action: "seriesBook",
    seriesId,
    userBookId: second.userBookId,
    sequenceLabel: "2",
    optional: false,
  });
  assert.equal((await service.read(one)).members.length, 2);
  const version = (await service.read(one)).version;
  await assert.rejects(
    service.change(one, {
      key: crypto.randomUUID(),
      expectedVersion: version,
      change: {
        action: "seriesBook",
        seriesId,
        userBookId: foreign.userBookId,
        sequenceLabel: "3",
        optional: false,
      },
    }),
    /not found/,
  );
  assert.equal((await service.read(one)).version, version);
  assert.equal((await service.read(two)).series.length, 0);
  await assert.rejects(
    service.change(two, {
      key: crypto.randomUUID(),
      expectedVersion: 0,
      change: { action: "seriesDelete", seriesId },
    }),
    /not found/,
  );
  await change({ action: "queueAdd", userBookId: original.id });
  await change({ action: "queueAdd", userBookId: second.userBookId });
  await change({ action: "queuePin", userBookId: original.id, pinned: true });
  await change({ action: "queuePin", userBookId: second.userBookId, pinned: true });
  assert.equal((await service.read(one)).queue.filter((r) => r.pinned).length, 1);
  assert.equal((await library.home(one)).next[0].id, second.userBookId);
  const request = {
    key: crypto.randomUUID(),
    expectedVersion: (await service.read(one)).version,
    change: { action: "queueRemove" as const, userBookId: original.id },
  };
  await service.change(one, request);
  await service.change(one, request);
  await assert.rejects(
    service.change(one, { ...request, change: { action: "queueAdd", userBookId: original.id } }),
    /already used/,
  );
  await assert.rejects(service.change(one, { ...request, key: crypto.randomUUID() }), /changed/);
  const archive = await library.archive(one);
  const parsed = parseRowanArchive(archive);
  assert.equal(parsed.series.length, 1);
  assert.equal(parsed.seriesItems.length, 2);
  assert.equal(parsed.readingQueue.length, 1);
  const corrupt = JSON.parse(archive);
  corrupt.seriesItems[0].userBookId = crypto.randomUUID();
  await assert.rejects(
    async () => account.restore(one, crypto.randomUUID(), JSON.stringify(corrupt)),
    /orphan/,
  );
  await account.restore(two, crypto.randomUUID(), archive);
  const restored = await service.read(two);
  assert.equal(restored.series[0].name, "A trilogy");
  assert.notEqual(restored.series[0].id, seriesId);
  assert.equal(restored.members.length, 2);
  assert.equal(restored.queue.length, 1);
  assert.equal((await service.read(one)).members.length, 2);
  await library.startReading(one, {
    key: crypto.randomUUID(),
    userBookId: second.userBookId,
    expectedVersion: 0,
    startedAt: null,
    unit: "page",
    position: 0,
  });
  assert.equal((await service.read(one)).queue.length, 0);
  await assert.rejects(
    change({ action: "queueAdd", userBookId: second.userBookId }),
    /already reading/,
  );
  await library.startReading(one, {
    key: crypto.randomUUID(),
    userBookId: original.id,
    expectedVersion: 0,
    startedAt: null,
    unit: "percent",
    position: 0,
  });
  assert.equal((await service.read(one)).books.find((b) => b.id === original.id)?.completed, true);

  await account.clear(two, crypto.randomUUID());
  assert.equal((await service.read(two)).series.length, 0);
  assert.equal((await service.read(one)).series.length, 1);
  assert.equal(
    (await pg.select().from(schema.books).where(eq(schema.books.id, first.id)))[0].title,
    first.title,
  );
  assert.equal(
    (await pg.select().from(v2.accountState).where(eq(v2.accountState.userId, 1)))[0].mirrorPaused,
    true,
  );
});
