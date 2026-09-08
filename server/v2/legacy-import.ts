import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as legacySchema from "../../shared/schema.ts";
import type { JsonValue } from "../../shared/json.ts";
import {
  editions,
  externalMappings,
  progressEntries,
  readingSessions,
  userBooks,
  works,
  margins as v2Margins,
  legacySyncSnapshots,
  accountState,
  ratings,
} from "../../shared/schema-v2.ts";

function snapshotHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function snapshotPayload(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

// The source database is never mutated. Share the library mutation lock so a
// repair cannot race a reader's first edit or another page's bootstrap request.
export async function importLegacyLibrary(
  database: NodePgDatabase<typeof legacySchema>,
  source: Pick<legacySchema.User, "id" | "username" | "displayName">,
  rows: legacySchema.BookRow[],
  sourceMargins: legacySchema.MarginRow[] = [],
  sourceGoals: legacySchema.GoalRow[] = [],
  sourceSettings?: legacySchema.UserSettingsRow,
) {
  // Provenance is auxiliary. Older staging databases may not have received
  // the audit-table migration yet, so never let that table prevent the core
  // legacy-to-Rowan translation from running.
  const snapshotTable = await database.execute(
    sql`select to_regclass('v2.legacy_sync_snapshots') as name`,
  );
  const snapshotsAvailable = Boolean(
    (snapshotTable as unknown as { rows?: Array<{ name?: string | null }> }).rows?.[0]?.name,
  );
  await database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(21071, ${source.id})`);
    const [target] = await tx
      .select()
      .from(legacySchema.users)
      .where(eq(legacySchema.users.id, source.id));
    if (target && target.username !== source.username)
      throw new Error("Staging account identity mismatch.");
    if (!target) await tx.insert(legacySchema.users).values(source);
    const [state] = await tx.select().from(accountState).where(eq(accountState.userId, source.id));
    if (state?.mirrorPaused) return;
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
      if (workId && state?.excludedWorkIds.includes(workId)) continue;
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
      const importedMetadata = {
        ...legacy.metadata,
        legacyImport: {
          reads: legacy.reads,
          status: legacy.status,
          currentPage: legacy.currentPage,
          currentMinute: legacy.currentMinute,
          totalPages: legacy.totalPages,
          durationMinutes: legacy.durationMinutes,
        },
      };
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
            legacyMetadata: importedMetadata,
          })
          .returning();
      }
      if (book.version === 0) {
        const rating = legacy.metadata?.rating;
        if (
          typeof rating === "number" &&
          rating > 0 &&
          rating <= 5 &&
          Number.isInteger(rating * 2)
        ) {
          await tx
            .insert(ratings)
            .values({ userBookId: book.id, halfStars: rating * 2 })
            .onConflictDoUpdate({ target: ratings.userBookId, set: { halfStars: rating * 2 } });
        }
        await tx
          .update(works)
          .set({
            title: legacy.title,
            authors: legacy.author ? [legacy.author] : [],
            coverUrl: legacy.coverUrl,
          })
          .where(eq(works.id, workId));
        await tx
          .update(userBooks)
          .set({
            status,
            isFavorite: legacy.metadata?.favorite === true,
            legacyMetadata: importedMetadata,
          })
          .where(eq(userBooks.id, book.id));
      }
      if (snapshotsAvailable) {
        await tx
          .insert(legacySyncSnapshots)
          .values({
            userId: source.id,
            entityKind: "book",
            sourceId: legacy.id,
            sourceHash: snapshotHash(legacy),
            payload: snapshotPayload(legacy),
          })
          .onConflictDoUpdate({
            target: [
              legacySyncSnapshots.userId,
              legacySyncSnapshots.entityKind,
              legacySyncSnapshots.sourceId,
            ],
            set: {
              sourceHash: snapshotHash(legacy),
              payload: snapshotPayload(legacy),
              observedAt: new Date(),
            },
          });
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
    for (const goal of sourceGoals.filter((row) => row.userId === source.id)) {
      if (state?.excludedGoalIds.includes(goal.id)) continue;
      await tx
        .insert(legacySchema.goals)
        .values(goal)
        .onConflictDoUpdate({
          target: legacySchema.goals.id,
          set: { metric: goal.metric, target: goal.target, timeframe: goal.timeframe },
        });
      if (snapshotsAvailable) {
        await tx
          .insert(legacySyncSnapshots)
          .values({
            userId: source.id,
            entityKind: "goal",
            sourceId: goal.id,
            sourceHash: snapshotHash(goal),
            payload: snapshotPayload(goal),
          })
          .onConflictDoUpdate({
            target: [
              legacySyncSnapshots.userId,
              legacySyncSnapshots.entityKind,
              legacySyncSnapshots.sourceId,
            ],
            set: {
              sourceHash: snapshotHash(goal),
              payload: snapshotPayload(goal),
              observedAt: new Date(),
            },
          });
      }
    }
    if (sourceSettings && sourceSettings.userId === source.id && !state?.settingsEdited) {
      await tx
        .insert(legacySchema.userSettings)
        .values(sourceSettings)
        .onConflictDoUpdate({
          target: legacySchema.userSettings.userId,
          set: {
            darkMode: sourceSettings.darkMode,
            accentColor: sourceSettings.accentColor,
            compactMode: sourceSettings.compactMode,
            fontScale: sourceSettings.fontScale,
          },
        });
      if (snapshotsAvailable) {
        await tx
          .insert(legacySyncSnapshots)
          .values({
            userId: source.id,
            entityKind: "settings",
            sourceId: String(source.id),
            sourceHash: snapshotHash(sourceSettings),
            payload: snapshotPayload(sourceSettings),
          })
          .onConflictDoUpdate({
            target: [
              legacySyncSnapshots.userId,
              legacySyncSnapshots.entityKind,
              legacySyncSnapshots.sourceId,
            ],
            set: {
              sourceHash: snapshotHash(sourceSettings),
              payload: snapshotPayload(sourceSettings),
              observedAt: new Date(),
            },
          });
      }
    }
    for (const margin of sourceMargins.filter((row) => row.userId === source.id)) {
      const [mapping] = await tx
        .select({ workId: externalMappings.workId })
        .from(externalMappings)
        .where(
          and(
            eq(externalMappings.provider, "legacy"),
            eq(externalMappings.entityKind, "work"),
            eq(externalMappings.externalId, margin.bookId),
          ),
        );
      if (!mapping) continue;
      const [book] = await tx
        .select({ id: userBooks.id })
        .from(userBooks)
        .where(and(eq(userBooks.userId, source.id), eq(userBooks.workId, mapping.workId)));
      if (!book) continue;
      const digest = createHash("md5").update(`legacy-margin:${margin.id}`).digest("hex");
      const marginId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${((parseInt(digest.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${digest.slice(18, 20)}-${digest.slice(20)}`;
      await tx
        .insert(v2Margins)
        .values({
          id: marginId,
          userBookId: book.id,
          body: margin.text,
          kind: margin.type === "quote" ? "quote" : "note",
          locator: margin.page ? `p. ${margin.page}` : null,
          createdAt: margin.createdAt,
          updatedAt: margin.createdAt,
        })
        .onConflictDoUpdate({
          target: v2Margins.id,
          set: { kind: margin.type === "quote" ? "quote" : "note" },
          setWhere: eq(v2Margins.version, 0),
        });
      if (snapshotsAvailable) {
        await tx
          .insert(legacySyncSnapshots)
          .values({
            userId: source.id,
            entityKind: "margin",
            sourceId: margin.id,
            sourceHash: snapshotHash(margin),
            payload: snapshotPayload(margin),
          })
          .onConflictDoUpdate({
            target: [
              legacySyncSnapshots.userId,
              legacySyncSnapshots.entityKind,
              legacySyncSnapshots.sourceId,
            ],
            set: {
              sourceHash: snapshotHash(margin),
              payload: snapshotPayload(margin),
              observedAt: new Date(),
            },
          });
      }
    }
  });
}
