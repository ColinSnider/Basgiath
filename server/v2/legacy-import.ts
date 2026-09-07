import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as legacySchema from "../../shared/schema.ts";
import {
  editions,
  externalMappings,
  progressEntries,
  readingSessions,
  userBooks,
  works,
} from "../../shared/schema-v2.ts";

// The source database is never mutated. Share the library mutation lock so a
// repair cannot race a reader's first edit or another page's bootstrap request.
export async function importLegacyLibrary(
  database: NodePgDatabase<typeof legacySchema>,
  source: Pick<legacySchema.User, "id" | "username" | "displayName">,
  rows: legacySchema.BookRow[],
) {
  await database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(21071, ${source.id})`);
    const [target] = await tx
      .select()
      .from(legacySchema.users)
      .where(eq(legacySchema.users.id, source.id));
    if (target && target.username !== source.username)
      throw new Error("Staging account identity mismatch.");
    if (!target) await tx.insert(legacySchema.users).values(source);
    for (const legacy of rows) {
      if (legacy.userId !== source.id) throw new Error("Legacy book owner mismatch.");
      const [known] = await tx
        .select()
        .from(externalMappings)
        .where(
          and(
            eq(externalMappings.provider, "legacy"),
            eq(externalMappings.entityKind, "work"),
            eq(externalMappings.externalId, legacy.id),
          ),
        );
      let workId = known?.workId;
      if (!workId) {
        const [work] = await tx
          .insert(works)
          .values({
            title: legacy.title,
            authors: legacy.author ? [legacy.author] : [],
            coverUrl: legacy.coverUrl,
          })
          .returning();
        workId = work.id;
        await tx
          .insert(externalMappings)
          .values({ provider: "legacy", entityKind: "work", externalId: legacy.id, workId });
      }
      let [book] = await tx
        .select()
        .from(userBooks)
        .where(and(eq(userBooks.workId, workId), eq(userBooks.userId, source.id)));
      const audio = legacy.format === "audiobook";
      const position = audio ? (legacy.currentMinute ?? 0) * 60 : (legacy.currentPage ?? 0);
      const suppliedTotal = audio ? (legacy.durationMinutes ?? 0) * 60 : legacy.totalPages;
      // Preserve the observed position even when an old edition's total is wrong.
      const total =
        suppliedTotal && suppliedTotal > 0 && suppliedTotal >= position ? suppliedTotal : null;
      const status =
        legacy.status === "reading" || legacy.status === "paused" || legacy.status === "dnf"
          ? legacy.status
          : legacy.status === "read" || legacy.status === "finished"
            ? "read"
            : "want_to_read";
      if (!book) {
        const [edition] = await tx
          .insert(editions)
          .values({
            workId,
            format: audio ? "audiobook" : legacy.format === "ebook" ? "ebook" : "book",
            pageCount: audio ? null : total,
            durationSeconds: audio ? total : null,
          })
          .returning();
        [book] = await tx
          .insert(userBooks)
          .values({
            userId: source.id,
            workId,
            selectedEditionId: edition.id,
            status,
            addedAt: legacy.addedAt,
            isFavorite: legacy.metadata?.favorite === true,
            legacyMetadata: {
              ...legacy.metadata,
              legacyImport: {
                reads: legacy.reads,
                status: legacy.status,
                currentPage: legacy.currentPage,
                currentMinute: legacy.currentMinute,
                totalPages: legacy.totalPages,
                durationMinutes: legacy.durationMinutes,
              },
            },
          })
          .returning();
      }
      const [existingSession] = await tx
        .select({ id: readingSessions.id })
        .from(readingSessions)
        .where(eq(readingSessions.userBookId, book.id))
        .limit(1);
      // Repair the old partial import, but never overwrite subsequent v2 work.
      if (existingSession || book.version !== 0) continue;
      await tx.update(userBooks).set({ status }).where(eq(userBooks.id, book.id));
      for (const read of legacy.reads) {
        const finishedAt = new Date(read.finishedAt);
        if (!Number.isFinite(finishedAt.getTime())) continue;
        await tx.insert(readingSessions).values({
          userBookId: book.id,
          workId,
          editionId: book.selectedEditionId,
          state: "completed",
          finishedAt,
          unit: audio ? "second" : "page",
          total,
          position: total ?? 0,
        });
      }
      if (status === "reading" || status === "paused") {
        const [session] = await tx
          .insert(readingSessions)
          .values({
            userBookId: book.id,
            workId,
            editionId: book.selectedEditionId,
            state: status === "paused" ? "paused" : "active",
            unit: audio ? "second" : "page",
            total,
            position,
          })
          .returning();
        // addedAt is not a reading start or a dated progress observation.
        await tx
          .insert(progressEntries)
          .values({ readingSessionId: session.id, kind: "baseline", position, occurredAt: null });
      }
    }
  });
}
