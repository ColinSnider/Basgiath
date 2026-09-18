import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/pglite/migrator";
import { users, sessions } from "../../shared/schema.ts";
import { createLibraryService } from "./library-service.ts";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const rowanMigrationConfig = {
  migrationsFolder: "migrations-v2",
} as const;

test("a fresh standalone database supports accounts and Rowan without legacy imports", async () => {
  const client = new PGlite();
  try {
    const database = drizzle(client);
    // PGlite prepared queries reject legacy files containing multiple statements.
    // Install those through exec; exercise the separate v2 journal through Drizzle.
    for (const migration of readMigrationFiles({ migrationsFolder: "migrations" })) {
      for (const sql of migration.sql) await client.exec(sql);
    }
    const bootstrap = async () => {
      await migrate(database, rowanMigrationConfig);
    };
    await bootstrap();
    await bootstrap();
    const [user] = await database
      .insert(users)
      .values({ username: "standalone", displayName: "Reader" })
      .returning();
    await database.insert(sessions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60000),
    });
    const library = createLibraryService(
      database as unknown as Parameters<typeof createLibraryService>[0],
      {
        fetchWork: async () => {
          throw new Error("Provider should not be needed");
        },
      },
    );
    assert.deepEqual(await library.listLibrary({ userId: user.id }), []);
    await library.saveManual(
      { userId: user.id },
      {
        key: crypto.randomUUID(),
        title: "A new beginning",
        author: "Author",
        format: "book",
        total: 100,
      },
    );
    assert.equal((await library.listLibrary({ userId: user.id })).length, 1);
    const tables = await client.query<{ books: string; sessions: string }>(
      "select to_regclass('v2.user_books') as books, to_regclass('v2.reading_sessions') as sessions",
    );
    assert.ok(tables.rows[0].books);
    assert.ok(tables.rows[0].sessions);
  } finally {
    await client.close();
  }
});

test("startup upgrades a pre-timer Rowan database and restores home and book history", async () => {
  const client = new PGlite();
  const folder = await mkdtemp(join(tmpdir(), "rowan-upgrade-"));
  try {
    const db = drizzle(client);
    for (const migration of readMigrationFiles({ migrationsFolder: "migrations" }))
      for (const sql of migration.sql) await client.exec(sql);
    const journal = JSON.parse(await readFile("migrations-v2/meta/_journal.json", "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 7);
    await mkdir(join(folder, "meta"));
    await writeFile(join(folder, "meta/_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries)
      await copyFile(`migrations-v2/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`));
    await migrate(db, { ...rowanMigrationConfig, migrationsFolder: folder });
    const [reader] = await db.insert(users).values({ username: "upgrade-reader" }).returning();
    const library = createLibraryService(
      db as unknown as Parameters<typeof createLibraryService>[0],
      {
        fetchWork: async () => {
          throw new Error("unused");
        },
      },
    );
    const actor = { userId: reader.id };
    const book = await library.saveManual(actor, {
      key: crypto.randomUUID(),
      title: "Kept through upgrade",
      author: "Reader",
      format: "book",
      total: 300,
    });
    await assert.rejects(library.home(actor));
    await assert.rejects(library.readingHistory(actor, book.userBookId));
    await migrate(db, rowanMigrationConfig);
    await migrate(db, rowanMigrationConfig);
    assert.equal((await library.home(actor)).next[0].title, "Kept through upgrade");
    assert.equal((await library.readingHistory(actor, book.userBookId)).sessions.length, 0);
    const attempt = await library.startReading(actor, {
      key: crypto.randomUUID(),
      userBookId: book.userBookId,
      expectedVersion: 0,
      startedAt: null,
      unit: "page",
      position: 0,
    });
    await library.timer(actor, {
      key: crypto.randomUUID(),
      sessionId: attempt.sessionId!,
      expectedVersion: 0,
      action: "start",
    });
    assert.ok((await library.home(actor)).current[0].timerStartedAt);
    assert.ok((await library.readingHistory(actor, book.userBookId)).sessions[0].timerStartedAt);
  } finally {
    await client.close();
    await rm(folder, { recursive: true, force: true });
  }
});
