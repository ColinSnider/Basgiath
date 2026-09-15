import { createHash } from "node:crypto";
import { and, eq, sql, asc, desc } from "drizzle-orm";
import type { db } from "../db.ts";
import { organizationCommand } from "../../shared/reading-organization.ts";
import {
  readerSeries as series,
  readerSeriesItems as items,
  readingQueue as queue,
  readingOrganization as state,
  userBooks,
  readingSessions,
  works,
  mutationReceipts,
} from "../../shared/schema-v2.ts";
import { DomainError, type Actor } from "./library-service.ts";

export function createOrganizationService(database: typeof db) {
  return {
    async read(actor: Actor) {
      return database.transaction(
        async (tx) => {
          const [version] = await tx.select().from(state).where(eq(state.userId, actor.userId));
          const groups = await tx
            .select()
            .from(series)
            .where(eq(series.userId, actor.userId))
            .orderBy(series.name);
          const members = await tx
            .select()
            .from(items)
            .where(eq(items.userId, actor.userId))
            .orderBy(items.sortOrder, items.id);
          const queued = await tx
            .select()
            .from(queue)
            .where(eq(queue.userId, actor.userId))
            .orderBy(desc(queue.pinned), queue.sortOrder, queue.userBookId);
          const books = await tx
            .select({
              id: userBooks.id,
              status: userBooks.status,
              completed: sql<boolean>`(${userBooks.status} = 'read' or exists (select 1 from ${readingSessions} where ${readingSessions.userBookId} = ${userBooks.id} and ${readingSessions.state} = 'completed'))`,
              title: sql<string>`coalesce(${userBooks.legacyMetadata}->'rowanDetails'->>'title', ${works.title})`,
              authors: sql<
                string[]
              >`coalesce(${userBooks.legacyMetadata}->'rowanDetails'->'authors', ${works.authors})`,
              coverUrl: sql<
                string | null
              >`case when ${userBooks.legacyMetadata}->'rowanDetails' ? 'coverUrl' then ${userBooks.legacyMetadata}->'rowanDetails'->>'coverUrl' else ${works.coverUrl} end`,
            })
            .from(userBooks)
            .innerJoin(works, eq(works.id, userBooks.workId))
            .where(eq(userBooks.userId, actor.userId))
            .orderBy(asc(works.title));
          return { version: version?.version ?? 0, series: groups, members, queue: queued, books };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async change(actor: Actor, input: unknown) {
      const data = organizationCommand.parse(input);
      const hash = createHash("sha256")
        .update(JSON.stringify({ operation: "organization", data }))
        .digest("hex");
      return database.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(21071, ${actor.userId})`);
        const [receipt] = await tx
          .select()
          .from(mutationReceipts)
          .where(
            and(eq(mutationReceipts.userId, actor.userId), eq(mutationReceipts.key, data.key)),
          );
        if (receipt) {
          if (receipt.fingerprint !== hash)
            throw new DomainError("IDEMPOTENCY_CONFLICT", "This request key was already used.");
          return;
        }
        await tx.insert(state).values({ userId: actor.userId }).onConflictDoNothing();
        const [current] = await tx.select().from(state).where(eq(state.userId, actor.userId));
        if (current.version !== data.expectedVersion)
          throw new DomainError(
            "VERSION_CONFLICT",
            "Your reading list changed. Review the refreshed list and try again.",
          );
        const c = data.change;
        if ("userBookId" in c) {
          const [book] = await tx
            .select()
            .from(userBooks)
            .where(and(eq(userBooks.id, c.userBookId), eq(userBooks.userId, actor.userId)));
          if (!book) throw new DomainError("NOT_FOUND", "Book not found in your library.");
          if (
            (c.action === "queueAdd" || c.action === "queuePin") &&
            !["want_to_read", "read"].includes(book.status)
          )
            throw new DomainError(
              "INVALID_TRANSITION",
              "Choose an unread book or a finished book to reread. This book is already reading, paused, or abandoned.",
            );
        }
        if ("seriesId" in c && c.action !== "seriesSave") {
          const [group] = await tx
            .select()
            .from(series)
            .where(and(eq(series.id, c.seriesId), eq(series.userId, actor.userId)));
          if (!group) throw new DomainError("NOT_FOUND", "Series not found.");
        }
        switch (c.action) {
          case "seriesSave": {
            const [existing] = await tx.select().from(series).where(eq(series.id, c.seriesId));
            if (existing && existing.userId !== actor.userId)
              throw new DomainError("NOT_FOUND", "Series not found.");
            const [duplicate] = await tx
              .select()
              .from(series)
              .where(and(eq(series.userId, actor.userId), eq(series.name, c.name)));
            if (duplicate && duplicate.id !== c.seriesId)
              throw new DomainError(
                "INVALID_TRANSITION",
                "You already have a series with that name.",
              );
            const values = {
              name: c.name,
              completionState: c.completionState,
              sourceNote: c.sourceNote,
            };
            if (existing) await tx.update(series).set(values).where(eq(series.id, c.seriesId));
            else
              await tx.insert(series).values({ ...values, id: c.seriesId, userId: actor.userId });
            break;
          }
          case "seriesDelete":
            await tx.delete(series).where(eq(series.id, c.seriesId));
            break;
          case "seriesBook": {
            const [last] = await tx
              .select({ order: items.sortOrder })
              .from(items)
              .where(eq(items.seriesId, c.seriesId))
              .orderBy(desc(items.sortOrder))
              .limit(1);
            await tx
              .insert(items)
              .values({
                userId: actor.userId,
                seriesId: c.seriesId,
                userBookId: c.userBookId,
                sequenceLabel: c.sequenceLabel,
                optional: c.optional,
                sortOrder: (last?.order ?? -1) + 1,
              })
              .onConflictDoUpdate({
                target: [items.seriesId, items.userBookId],
                set: { sequenceLabel: c.sequenceLabel, optional: c.optional },
              });
            break;
          }
          case "seriesRemoveBook":
            await tx
              .delete(items)
              .where(and(eq(items.seriesId, c.seriesId), eq(items.userBookId, c.userBookId)));
            break;
          case "seriesMove": {
            const rows = await tx
              .select()
              .from(items)
              .where(eq(items.seriesId, c.seriesId))
              .orderBy(items.sortOrder, items.id);
            const index = rows.findIndex((r) => r.userBookId === c.userBookId);
            if (index < 0) throw new DomainError("NOT_FOUND", "Series book not found.");
            const to = index + (c.direction === "up" ? -1 : 1);
            if (to >= 0 && to < rows.length) [rows[index], rows[to]] = [rows[to], rows[index]];
            for (const [sortOrder, row] of rows.entries())
              await tx.update(items).set({ sortOrder }).where(eq(items.id, row.id));
            break;
          }
          case "queueAdd": {
            const [last] = await tx
              .select()
              .from(queue)
              .where(eq(queue.userId, actor.userId))
              .orderBy(desc(queue.sortOrder))
              .limit(1);
            await tx
              .insert(queue)
              .values({
                userId: actor.userId,
                userBookId: c.userBookId,
                sortOrder: (last?.sortOrder ?? -1) + 1,
              })
              .onConflictDoNothing();
            break;
          }
          case "queueRemove":
            await tx.delete(queue).where(eq(queue.userBookId, c.userBookId));
            break;
          case "queuePin": {
            const [row] = await tx.select().from(queue).where(eq(queue.userBookId, c.userBookId));
            if (!row) throw new DomainError("NOT_FOUND", "Add the book to your queue first.");
            if (c.pinned)
              await tx.update(queue).set({ pinned: false }).where(eq(queue.userId, actor.userId));
            await tx
              .update(queue)
              .set({ pinned: c.pinned })
              .where(eq(queue.userBookId, c.userBookId));
            break;
          }
          case "queueMove": {
            const rows = await tx
              .select()
              .from(queue)
              .where(and(eq(queue.userId, actor.userId), eq(queue.pinned, false)))
              .orderBy(queue.sortOrder, queue.userBookId);
            const index = rows.findIndex((r) => r.userBookId === c.userBookId);
            if (index < 0) throw new DomainError("NOT_FOUND", "Queued book not found.");
            const to = index + (c.direction === "up" ? -1 : 1);
            if (to >= 0 && to < rows.length) [rows[index], rows[to]] = [rows[to], rows[index]];
            for (const [sortOrder, row] of rows.entries())
              await tx.update(queue).set({ sortOrder }).where(eq(queue.userBookId, row.userBookId));
          }
        }
        await tx
          .update(state)
          .set({ version: current.version + 1 })
          .where(eq(state.userId, actor.userId));
        await tx
          .insert(mutationReceipts)
          .values({ userId: actor.userId, key: data.key, fingerprint: hash, result: { ok: true } });
      });
    },
  };
}
