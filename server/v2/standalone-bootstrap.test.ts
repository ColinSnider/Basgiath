import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/pglite/migrator";
import { users, sessions } from "../../shared/schema.ts";
import { createLibraryService } from "./library-service.ts";

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
      await migrate(database, {
        migrationsFolder: "migrations-v2",
        migrationsSchema: "rowan_migrations",
      });
    };
    await bootstrap();
    await bootstrap();
    const [user] = await database
      .insert(users)
      .values({ username: "standalone", displayName: "Reader" })
      .returning();
    await database
      .insert(sessions)
      .values({
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
