import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../../shared/schema.ts";
import { readingSessions } from "../../shared/schema-v2.ts";
import { createLibraryService } from "./library-service.ts";
import { createAccountService } from "./account-service.ts";
import { parseRowanArchive } from "../../shared/rowan-archive.ts";

test("reading timer survives navigation, retries, transitions and archive restore without crossing accounts", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  for (const file of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
    await client.exec(await readFile(`migrations/${file}`, "utf8"));
  for (const file of (await readdir("migrations-v2")).filter((f) => f.endsWith(".sql")).sort())
    await client.exec(await readFile(`migrations-v2/${file}`, "utf8"));
  const database = drizzle(client, { schema });
  const db = database as unknown as Parameters<typeof createLibraryService>[0];
  await database.insert(schema.users).values([
    { id: 1, username: "one" },
    { id: 2, username: "two" },
  ]);
  const library = createLibraryService(db, {
    async fetchWork() {
      throw new Error("unused");
    },
  });
  const actor = { userId: 1 };
  const key = () => crypto.randomUUID();
  const book = await library.saveManual(actor, {
    key: key(),
    title: "Timed book",
    author: "Reader",
    format: "book",
    total: 300,
  });
  const attempt = await library.startReading(actor, {
    key: key(),
    userBookId: book.userBookId,
    expectedVersion: 0,
    startedAt: null,
    unit: "page",
    position: 0,
  });
  const sessionId = attempt.sessionId!;
  const request = { key: key(), sessionId, expectedVersion: 0, action: "start" as const };
  await library.timer(actor, request);
  await library.timer(actor, request);
  assert.ok((await library.readingHistory(actor, book.userBookId)).sessions[0].timerStartedAt);
  await assert.rejects(library.timer({ userId: 2 }, { ...request, key: key() }), /not found/i);
  await assert.rejects(
    library.timer(actor, { ...request, key: key(), expectedVersion: 1 }),
    /already running/,
  );
  await database
    .update(readingSessions)
    .set({ timerStartedAt: new Date(Date.now() - 65000) })
    .where(eq(readingSessions.id, sessionId));
  const stop = { key: key(), sessionId, expectedVersion: 1, action: "stop" as const };
  await library.timer(actor, stop);
  await library.timer(actor, stop);
  let session = (await library.readingHistory(actor, book.userBookId)).sessions[0];
  assert.equal(session.timedReads.length, 1);
  assert.ok(session.readingSeconds >= 65);
  assert.equal(session.timerStartedAt, null);
  const saved = session.readingSeconds;
  await library.timer(actor, { key: key(), sessionId, expectedVersion: 2, action: "start" });
  await database
    .update(readingSessions)
    .set({ timerStartedAt: new Date(Date.now() - 30000) })
    .where(eq(readingSessions.id, sessionId));
  const archive = await library.archive(actor);
  const parsed = parseRowanArchive(archive);
  assert.equal(parsed.readingSessions[0].timerStartedAt, null);
  assert.ok(parsed.readingSessions[0].readingSeconds >= saved + 30);
  await createAccountService(db).restore({ userId: 2 }, key(), archive);
  const restored = JSON.parse(await library.archive({ userId: 2 }));
  assert.equal(
    restored.readingSessions[0].readingSeconds,
    parsed.readingSessions[0].readingSeconds,
  );
  assert.equal(restored.readingSessions[0].timerStartedAt, null);
  await library.transitionReading(actor, {
    key: key(),
    sessionId,
    expectedVersion: 3,
    action: "pause",
    occurredAt: null,
  });
  session = (await library.readingHistory(actor, book.userBookId)).sessions[0];
  assert.equal(session.timerStartedAt, null);
  assert.equal(session.timedReads.length, 2);
  await assert.rejects(
    library.timer(actor, { key: key(), sessionId, expectedVersion: 4, action: "start" }),
    /Resume/,
  );
  const older = JSON.parse(archive);
  older.version = 4;
  for (const s of older.readingSessions) {
    delete s.timerStartedAt;
    delete s.readingSeconds;
    delete s.timedReads;
  }
  assert.equal(parseRowanArchive(JSON.stringify(older)).readingSessions[0].readingSeconds, 0);
});
