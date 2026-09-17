import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../shared/schema-v2.ts";
import { users } from "../../shared/schema.ts";
import { createLibraryService } from "./library-service.ts";
import { createAccountService } from "./account-service.ts";
import { parseRowanArchive } from "../../shared/rowan-archive.ts";

test("custom goals preserve logged progress through retries, edits, archive restore and deletion", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  for (const file of ["0000_initial_schema.sql", "0002_book_metadata.sql"])
    await client.exec(await readFile(`migrations/${file}`, "utf8"));
  for (const file of (await readdir("migrations-v2")).filter((f) => f.endsWith(".sql")).sort())
    await client.exec(await readFile(`migrations-v2/${file}`, "utf8"));
  const db = drizzle(client, { schema });
  await db.insert(users).values([
    { id: 1, username: "reader" },
    { id: 2, username: "other" },
  ]);
  const database = db as unknown as Parameters<typeof createLibraryService>[0];
  const library = createLibraryService(database, {
    fetchWork: async () => {
      throw new Error("Not used");
    },
  });
  const account = createAccountService(database);
  const actor = { userId: 1 },
    other = { userId: 2 },
    key = () => crypto.randomUUID();
  const goalId = key();
  await library.saveGoal(actor, {
    key: goalId,
    metric: "custom",
    title: "Explore genres",
    unit: "genres",
    timeframe: "all_time",
    target: 10,
  });
  const entry = { key: key(), goalId, amount: 3, date: "2026-09-01", note: "Three genres" };
  await library.logGoal(actor, entry);
  await library.logGoal(actor, entry);
  await assert.rejects(library.logGoal(actor, { ...entry, amount: 5 }));
  await assert.rejects(library.logGoal(other, { ...entry, key: key() }));
  await library.logGoal(actor, { ...entry, key: key(), amount: -1, note: "Correction" });
  await library.saveGoal(actor, {
    key: key(),
    id: goalId,
    metric: "custom",
    title: "New genres",
    unit: "genres",
    timeframe: "all_time",
    target: 12,
  });
  const [goal] = await library.goals(actor, "UTC", new Date("2026-09-16T12:00:00Z"));
  assert.equal(goal.progress.current, 2);
  assert.equal(goal.details.entries.length, 2);
  const archive = await library.archive(actor);
  assert.equal(parseRowanArchive(archive).goals[0].details.entries.length, 2);
  const duplicate = JSON.parse(archive);
  duplicate.goals[0].details.entries.push(duplicate.goals[0].details.entries[0]);
  assert.throws(() => parseRowanArchive(JSON.stringify(duplicate)));
  await assert.rejects(library.saveGoal(actor, {
    key: key(), metric: "custom", title: "   ", unit: "chapters", target: 10, timeframe: "month",
  }));
  await account.restore(other, key(), archive);
  const [restored] = await library.goals(other, "UTC", new Date("2026-09-16T12:00:00Z"));
  assert.equal(restored.details.title, "New genres");
  assert.equal(restored.progress.current, 2);
  assert.notEqual(restored.id, goalId);
  await account.deleteGoal(actor, key(), goalId);
  assert.equal((await library.goals(actor)).length, 0);
  assert.equal((await db.select().from(schema.goalDetails)).length, 1);
});
