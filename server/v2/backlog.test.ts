import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { users } from "../../shared/schema.ts";
import { createLibraryService } from "./library-service.ts";
import { mapCsvRow, parseCsv, csvDate } from "../../shared/csv-backlog.ts";
test("CSV handles quotes, multiline text, mapped dates and invalid dates", () => {
  const rows = parseCsv('\uFEFFAuthor,Title,Finish\r\n"A, B","A ""book""\n雪",09/12/2026\r\n');
  assert.equal(rows[1][1], 'A "book"\n雪');
  const row = mapCsvRow(rows[1], { title: 1, author: 0, finishedAt: 2 }, "mdy");
  assert.equal(row.reads, 1);
  assert.equal(row.author, "A, B");
  assert.throws(() => csvDate("2026-02-30", "iso"));
  assert.throws(() => parseCsv('Title\n"unfinished'));
  assert.throws(() => parseCsv("Title,Author\nOnly one"));
});
test("backlog import and history edits are atomic, private and retry safe", async () => {
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
    const service = createLibraryService(
      database as unknown as Parameters<typeof createLibraryService>[0],
      {
        fetchWork: async () => {
          throw new Error("unused");
        },
      },
    );
    const actor = { userId: 1 },
      key = () => crypto.randomUUID();
    const row = {
      title: "Backlog",
      author: "Author",
      format: "book" as const,
      total: 300,
      reads: 3,
      startedAt: "2024-01-01T12:00:00Z",
      finishedAt: "2024-02-01T12:00:00Z",
    };
    const payload = { key: key(), rows: [row] };
    const saved = await service.importBacklog(actor, payload);
    assert.deepEqual(await service.importBacklog(actor, payload), saved);
    let history = await service.readingHistory(actor, saved.userBookId);
    assert.equal(history.sessions.length, 3);
    assert.equal(history.entries.length, 0);
    assert.equal(history.sessions.filter((s) => !s.finishedAt).length, 2);
    assert.equal(
      history.sessions.reduce((n, s) => n + s.loggedProgress, 0),
      0,
    );
    const session = history.sessions.find((s) => s.finishedAt)!;
    const correction = {
      key: key(),
      userBookId: saved.userBookId,
      sessionId: session.id,
      expectedVersion: 0,
      action: "dates" as const,
      startedAt: null,
      finishedAt: null,
    };
    await assert.rejects(service.changeHistory({ userId: 2 }, correction), /not found/i);
    await service.changeHistory(actor, correction);
    await service.changeHistory(actor, correction);
    await assert.rejects(service.changeHistory(actor, { ...correction, key: key() }), /changed/i);
    await service.changeHistory(actor, {
      ...correction,
      key: key(),
      expectedVersion: 1,
      action: "remove",
    });
    history = await service.readingHistory(actor, saved.userBookId);
    assert.equal(history.sessions.length, 2);
    const before = (await service.listLibrary(actor)).length;
    await assert.rejects(
      service.importBacklog(actor, { key: key(), rows: [row, { ...row, userBookId: key() }] }),
      /not found/i,
    );
    assert.equal((await service.listLibrary(actor)).length, before);
    await assert.rejects(
      service.importBacklog(actor, {
        key: key(),
        rows: [{ ...row, finishedAt: "2023-01-01T12:00:00Z" }],
      }),
    );
    const archive = JSON.parse(await service.archive(actor));
    assert.equal(
      archive.readingSessions.filter(
        (s: { userBookId: string }) => s.userBookId === saved.userBookId,
      ).length,
      2,
    );
  } finally {
    await client.close();
  }
});
