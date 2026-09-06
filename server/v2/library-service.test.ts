import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { users, books as legacyBooks } from "../../shared/schema.ts";
import * as schema from "../../shared/schema-v2.ts";
import { createLibraryService, DomainError, type CatalogProvider } from "./library-service.ts";

const key = () => crypto.randomUUID();
const actor = { userId: 1 };
const other = { userId: 2 };
const ref = { provider: "fixture", externalId: "work-remote-1" };
const start = "2026-09-01T12:00:00.000Z";
const later = "2026-09-02T12:00:00.000Z";
const code = (expected: string) => (error: unknown) =>
  error instanceof DomainError && error.code === expected;

test("v2 catalog and reading lifecycle work against isolated PostgreSQL", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  await client.exec(
    await readFile(new URL("../../migrations/0000_initial_schema.sql", import.meta.url), "utf8"),
  );
  await client.exec(
    await readFile(new URL("../../migrations/0002_book_metadata.sql", import.meta.url), "utf8"),
  );
  await client.exec(
    await readFile(
      new URL("../../migrations-v2/0000_catalog_reading_foundation.sql", import.meta.url),
      "utf8",
    ),
  );
  const database = drizzle(client, { schema });
  await database.insert(users).values([
    { id: 1, username: "one" },
    { id: 2, username: "two" },
  ]);
  await database.insert(legacyBooks).values({
    id: "legacy-book",
    userId: 1,
    title: "Preserve",
    author: "Reader",
    metadata: { rating: 4.5, unknown: [null, "exact"] },
    reads: [{ finishedAt: start }],
  });
  const original = await database.select().from(legacyBooks);
  let providerAvailable = true;
  const provider: CatalogProvider = {
    async fetchWork(input) {
      if (!providerAvailable) throw new Error("offline");
      return {
        title: "One Work",
        authors: ["One Author"],
        coverUrl: null,
        edition: {
          externalId: `edition-${input.externalId}`,
          format: input.externalId === "audio" ? "audiobook" : "book",
          pageCount: input.externalId === "audio" ? null : 300,
          durationSeconds: input.externalId === "audio" ? 36000 : null,
          language: "en",
        },
      };
    },
  };
  const service = createLibraryService(
    database as unknown as Parameters<typeof createLibraryService>[0],
    provider,
  );
  const saveRequest = { key: key(), ref };
  const saved = await service.saveWork(actor, saveRequest);
  let sessionId = "";

  await t.test("library page is bounded, owner scoped, and filters literal text", async () => {
    assert.equal((await service.libraryPage(actor, { query: "One Author" })).items.length, 1);
    assert.equal((await service.libraryPage(other, {})).items.length, 0);
    assert.equal((await service.libraryPage(actor, { status: "reading" })).items.length, 0);
    assert.equal((await service.libraryPage(actor, { query: "%" })).items.length, 0);
    assert.equal((await service.libraryPage(actor, {})).nextOffset, null);
    await assert.rejects(service.libraryPage(actor, { offset: -1 }));
  });

  await t.test("provider identity maps to UUID and one work serves multiple users", async () => {
    assert.notEqual(saved.workId, ref.externalId);
    assert.match(saved.workId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(await service.saveWork(actor, saveRequest), saved);
    const secondSave = await service.saveWork(actor, { key: key(), ref });
    const otherSave = await service.saveWork(other, { key: key(), ref });
    assert.equal(secondSave.userBookId, saved.userBookId);
    assert.equal(otherSave.workId, saved.workId);
    assert.notEqual(otherSave.userBookId, saved.userBookId);
    assert.equal((await database.select().from(schema.works)).length, 1);
    assert.equal((await service.listLibrary(actor)).length, 1);
    assert.equal((await service.listLibrary(other)).length, 1);
  });

  await t.test("known catalog works remain available without provider", async () => {
    providerAvailable = false;
    assert.equal((await service.saveWork(actor, { key: key(), ref })).workId, saved.workId);
    await assert.rejects(
      service.saveWork(actor, { key: key(), ref: { ...ref, externalId: "missing" } }),
      code("PROVIDER_UNAVAILABLE"),
    );
    providerAvailable = true;
  });

  await t.test("starting records only a baseline and snapshots the edition total", async () => {
    const request = {
      key: key(),
      userBookId: saved.userBookId,
      expectedVersion: 0,
      startedAt: start,
      unit: "page" as const,
      position: 80,
    };
    const started = await service.startReading(actor, request);
    sessionId = started.sessionId!;
    assert.deepEqual(await service.startReading(actor, request), started);
    const history = await service.readingHistory(actor, saved.userBookId);
    assert.equal(history.sessions.length, 1);
    assert.equal(history.sessions[0].total, 300);
    assert.equal(history.entries[0].kind, "baseline");
    assert.equal(history.entries[0].position, 80);
    await assert.rejects(
      service.startReading(actor, { ...request, key: key(), expectedVersion: 1 }),
      code("INVALID_TRANSITION"),
    );
  });

  await t.test("ownership protects history and every reading mutation", async () => {
    await assert.rejects(service.readingHistory(other, saved.userBookId), code("NOT_FOUND"));
    await assert.rejects(
      service.startReading(other, {
        key: key(),
        userBookId: saved.userBookId,
        expectedVersion: 1,
        startedAt: start,
        unit: "page",
      }),
      code("NOT_FOUND"),
    );
    await assert.rejects(
      service.recordProgress(other, {
        key: key(),
        sessionId,
        expectedVersion: 0,
        position: 90,
        occurredAt: later,
      }),
      code("NOT_FOUND"),
    );
    await assert.rejects(
      service.transitionReading(other, {
        key: key(),
        sessionId,
        expectedVersion: 0,
        action: "finish",
        occurredAt: later,
      }),
      code("NOT_FOUND"),
    );
  });

  await t.test(
    "progress persists exactly once, rejects stale versions and changed retry payloads",
    async () => {
      const request = {
        key: key(),
        sessionId,
        expectedVersion: 0,
        position: 100,
        occurredAt: later,
      };
      const result = await service.recordProgress(actor, request);
      assert.deepEqual(await service.recordProgress(actor, request), result);
      await assert.rejects(
        service.recordProgress(actor, { ...request, position: 110 }),
        code("IDEMPOTENCY_CONFLICT"),
      );
      await assert.rejects(
        service.recordProgress(actor, { ...request, key: key() }),
        code("VERSION_CONFLICT"),
      );
      assert.equal((await service.readingHistory(actor, saved.userBookId)).entries.length, 2);
    },
  );

  await t.test("invalid progress is atomic, pause/resume changes state", async () => {
    for (const position of [99, 301])
      await assert.rejects(
        service.recordProgress(actor, {
          key: key(),
          sessionId,
          expectedVersion: 1,
          position,
          occurredAt: later,
        }),
        code("INVALID_TRANSITION"),
      );
    await assert.rejects(
      service.recordProgress(actor, {
        key: key(),
        sessionId,
        expectedVersion: 1,
        position: 120,
        occurredAt: start,
      }),
      code("INVALID_TRANSITION"),
    );
    await service.transitionReading(actor, {
      key: key(),
      sessionId,
      expectedVersion: 1,
      action: "pause",
      occurredAt: null,
    });
    await assert.rejects(
      service.recordProgress(actor, {
        key: key(),
        sessionId,
        expectedVersion: 2,
        position: 120,
        occurredAt: later,
      }),
      code("INVALID_TRANSITION"),
    );
    await service.transitionReading(actor, {
      key: key(),
      sessionId,
      expectedVersion: 2,
      action: "resume",
      occurredAt: null,
    });
    const history = await service.readingHistory(actor, saved.userBookId);
    assert.equal(history.entries.length, 2);
    assert.equal(history.sessions[0].position, 100);
  });

  await t.test("finishing is retry safe and never fabricates a progress event", async () => {
    const request = {
      key: key(),
      sessionId,
      expectedVersion: 3,
      action: "finish" as const,
      occurredAt: later,
    };
    await assert.rejects(
      service.transitionReading(actor, { ...request, key: key(), occurredAt: start }),
      code("INVALID_TRANSITION"),
    );
    const result = await service.transitionReading(actor, request);
    assert.deepEqual(await service.transitionReading(actor, request), result);
    const history = await service.readingHistory(actor, saved.userBookId);
    assert.equal(history.entries.length, 2);
    assert.equal(history.sessions[0].state, "completed");
    assert.equal(history.sessions[0].position, 100);
  });

  await t.test("rereading keeps old attempt and edition total snapshot", async () => {
    await database.update(schema.editions).set({ pageCount: 320 });
    const [{ userBook }] = await service.listLibrary(actor);
    await service.startReading(actor, {
      key: key(),
      userBookId: saved.userBookId,
      expectedVersion: userBook.version,
      startedAt: null,
      unit: "page",
    });
    const history = await service.readingHistory(actor, saved.userBookId);
    assert.equal(history.sessions.length, 2);
    assert.equal(history.sessions.find((s) => s.id === sessionId)!.total, 300);
    const active = history.sessions.find((s) => s.state === "active")!;
    assert.equal(active.total, 320);
    assert.equal(active.startedAt, null);
    await service.transitionReading(actor, {
      key: key(),
      sessionId: active.id,
      expectedVersion: 0,
      action: "dnf",
      occurredAt: null,
    });
    assert.equal(
      (await service.readingHistory(actor, saved.userBookId)).sessions.filter(
        (s) => s.state === "completed",
      ).length,
      1,
    );
  });

  await t.test("audio uses seconds and rejects page progress", async () => {
    const audio = await service.saveWork(actor, {
      key: key(),
      ref: { ...ref, externalId: "audio" },
    });
    await assert.rejects(
      service.startReading(actor, {
        key: key(),
        userBookId: audio.userBookId,
        expectedVersion: 0,
        startedAt: null,
        unit: "page",
      }),
      code("INVALID_TRANSITION"),
    );
    await service.startReading(actor, {
      key: key(),
      userBookId: audio.userBookId,
      expectedVersion: 0,
      startedAt: null,
      unit: "second",
      position: 3600,
    });
    const history = await service.readingHistory(actor, audio.userBookId);
    assert.equal(history.sessions[0].total, 36000);
    assert.equal(history.sessions[0].position, 3600);
    assert.equal(history.entries[0].kind, "baseline");
  });

  await t.test(
    "database rejects an edition from another work and legacy data remains intact",
    async () => {
      const [{ userBook: audioBook }] = (await service.listLibrary(actor)).filter(
        (row) => row.work.id !== saved.workId,
      );
      await assert.rejects(
        database
          .update(schema.userBooks)
          .set({ selectedEditionId: audioBook.selectedEditionId })
          .where(eq(schema.userBooks.id, saved.userBookId)),
      );
      assert.deepEqual(await database.select().from(legacyBooks), original);
      await assert.rejects(
        database.insert(schema.readingSessions).values({
          userBookId: saved.userBookId,
          workId: saved.workId,
          state: "completed",
          unit: "percent",
          total: null,
        }),
        (error: unknown) => {
          const cause = (error as { cause?: { constraint?: string } }).cause;
          return cause?.constraint === "percent_total";
        },
      );
    },
  );

  await t.test("parallel retries converge on one response and one membership", async () => {
    const request = { key: key(), ref: { ...ref, externalId: "parallel-work" } };
    const [a, b] = await Promise.all([
      service.saveWork(actor, request),
      service.saveWork(actor, request),
    ]);
    assert.deepEqual(a, b);
    const sameWork = (await service.listLibrary(actor)).filter((row) => row.work.id === a.workId);
    assert.equal(sameWork.length, 1);
    const startRequest = {
      key: key(),
      userBookId: a.userBookId,
      expectedVersion: 0,
      startedAt: start,
      unit: "page" as const,
    };
    const [first, retry] = await Promise.all([
      service.startReading(actor, startRequest),
      service.startReading(actor, startRequest),
    ]);
    assert.deepEqual(first, retry);
    assert.equal((await service.readingHistory(actor, a.userBookId)).sessions.length, 1);
  });
});
