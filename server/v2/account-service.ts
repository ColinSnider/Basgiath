import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { db } from "../db.ts";
import { goals, userSettings } from "../../shared/schema.ts";
import * as s from "../../shared/schema-v2.ts";
import { bookEditSchema, parseRowanArchive, settingsSchema } from "../../shared/rowan-archive.ts";
import { DomainError, type Actor } from "./library-service.ts";

type Database = typeof db;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const uuid = z.string().uuid();
const defaults = {
  darkMode: false,
  accentColor: "default",
  compactMode: false,
  fontScale: "md" as const,
};

export function createAccountService(database: Database) {
  async function mutate(
    actor: Actor,
    key: string,
    operation: string,
    input: unknown,
    action: (tx: Tx) => Promise<void>,
  ) {
    z.number().int().positive().parse(actor.userId);
    uuid.parse(key);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ operation, input }))
      .digest("hex");
    await database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(21071, ${actor.userId})`);
      const [receipt] = await tx
        .select()
        .from(s.mutationReceipts)
        .where(and(eq(s.mutationReceipts.userId, actor.userId), eq(s.mutationReceipts.key, key)));
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new DomainError(
            "IDEMPOTENCY_CONFLICT",
            "Request key already used for another change.",
          );
        return;
      }
      await tx.insert(s.accountState).values({ userId: actor.userId }).onConflictDoNothing();
      await action(tx);
      await tx
        .insert(s.mutationReceipts)
        .values({ userId: actor.userId, key, fingerprint, result: { ok: true } });
    });
    return { ok: true as const };
  }
  async function removeBooks(tx: Tx, actor: Actor, bookId?: string) {
    await tx
      .insert(s.readingOrganization)
      .values({ userId: actor.userId, version: 1 })
      .onConflictDoUpdate({
        target: s.readingOrganization.userId,
        set: { version: sql`${s.readingOrganization.version} + 1` },
      });
    const owned = sql`select ${s.userBooks.id} from ${s.userBooks} where ${s.userBooks.userId} = ${actor.userId} ${bookId ? sql`and ${s.userBooks.id} = ${bookId}` : sql``}`;
    await tx
      .delete(s.progressEntries)
      .where(
        sql`${s.progressEntries.readingSessionId} in (select ${s.readingSessions.id} from ${s.readingSessions} where ${s.readingSessions.userBookId} in (${owned}))`,
      );
    await tx.delete(s.readingSessions).where(sql`${s.readingSessions.userBookId} in (${owned})`);
    await tx.delete(s.shelfItems).where(sql`${s.shelfItems.userBookId} in (${owned})`);
    await tx.delete(s.ratings).where(sql`${s.ratings.userBookId} in (${owned})`);
    await tx.delete(s.margins).where(sql`${s.margins.userBookId} in (${owned})`);
    await tx
      .delete(s.userBooks)
      .where(
        and(eq(s.userBooks.userId, actor.userId), bookId ? eq(s.userBooks.id, bookId) : undefined),
      );
  }
  async function clear(tx: Tx, actor: Actor) {
    await removeBooks(tx, actor);
    await tx.delete(s.readerSeries).where(eq(s.readerSeries.userId, actor.userId));
    await tx.delete(s.shelves).where(eq(s.shelves.userId, actor.userId));
    await tx.delete(goals).where(eq(goals.userId, actor.userId));
    await tx.delete(userSettings).where(eq(userSettings.userId, actor.userId));
    await tx.delete(s.legacySyncSnapshots).where(eq(s.legacySyncSnapshots.userId, actor.userId));
    // Prevent refresh from silently repopulating a cleared or restored account.
    await tx
      .update(s.accountState)
      .set({ mirrorPaused: true, settingsEdited: true, blackBackground: false })
      .where(eq(s.accountState.userId, actor.userId));
  }
  return {
    async settings(actor: Actor) {
      const [settings] = await database
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, actor.userId));
      const [state] = await database
        .select()
        .from(s.accountState)
        .where(eq(s.accountState.userId, actor.userId));
      return { settings: {...(settings ?? defaults), blackBackground: state?.blackBackground ?? false}, mirrorPaused: state?.mirrorPaused ?? false };
    },
    saveSettings(actor: Actor, key: string, input: unknown) {
      const data = settingsSchema.parse(input);
      const {blackBackground, ...legacySettings} = data;
      return mutate(actor, key, "settings", data, async (tx) => {
        await tx
          .insert(userSettings)
          .values({ userId: actor.userId, ...legacySettings })
          .onConflictDoUpdate({ target: userSettings.userId, set: legacySettings });
        await tx
          .update(s.accountState)
          .set({ settingsEdited: true, blackBackground })
          .where(eq(s.accountState.userId, actor.userId));
      });
    },
    deleteBook(actor: Actor, key: string, input: { userBookId: string; expectedVersion: number }) {
      const data = z
        .object({ userBookId: uuid, expectedVersion: z.number().int().nonnegative() })
        .strict()
        .parse(input);
      return mutate(actor, key, "deleteBook", data, async (tx) => {
        const [book] = await tx
          .select()
          .from(s.userBooks)
          .where(and(eq(s.userBooks.id, data.userBookId), eq(s.userBooks.userId, actor.userId)));
        if (!book) throw new DomainError("NOT_FOUND", "Book not found.");
        if (book.version !== data.expectedVersion)
          throw new DomainError("VERSION_CONFLICT", "Book changed. Refresh before deleting.");
        const [state] = await tx
          .select()
          .from(s.accountState)
          .where(eq(s.accountState.userId, actor.userId));
        await tx
          .update(s.accountState)
          .set({ excludedWorkIds: [...new Set([...state.excludedWorkIds, book.workId])] })
          .where(eq(s.accountState.userId, actor.userId));
        // Invalidate shelf versions held by other tabs.
        await tx
          .update(s.shelves)
          .set({ version: sql`${s.shelves.version} + 1` })
          .where(
            sql`${s.shelves.id} in (select ${s.shelfItems.shelfId} from ${s.shelfItems} where ${s.shelfItems.userBookId} = ${book.id})`,
          );
        const sourceIds = sql`select ${s.externalMappings.externalId} from ${s.externalMappings} where ${s.externalMappings.workId} = ${book.workId} and ${s.externalMappings.provider} = 'legacy'`;
        await tx
          .delete(s.legacySyncSnapshots)
          .where(
            and(
              eq(s.legacySyncSnapshots.userId, actor.userId),
              sql`(${s.legacySyncSnapshots.entityKind} = 'book' and ${s.legacySyncSnapshots.sourceId} in (${sourceIds})) or (${s.legacySyncSnapshots.entityKind} = 'margin' and ${s.legacySyncSnapshots.payload}->>'bookId' in (${sourceIds}))`,
            ),
          );
        await removeBooks(tx, actor, book.id);
      });
    },
    deleteGoal(actor: Actor, key: string, goalId: string) {
      z.string().min(1).parse(goalId);
      return mutate(actor, key, "deleteGoal", goalId, async (tx) => {
        const [goal] = await tx
          .select()
          .from(goals)
          .where(and(eq(goals.id, goalId), eq(goals.userId, actor.userId)));
        if (!goal) throw new DomainError("NOT_FOUND", "Goal not found.");
        const [state] = await tx
          .select()
          .from(s.accountState)
          .where(eq(s.accountState.userId, actor.userId));
        await tx
          .update(s.accountState)
          .set({ excludedGoalIds: [...new Set([...state.excludedGoalIds, goalId])] })
          .where(eq(s.accountState.userId, actor.userId));
        await tx.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, actor.userId)));
        await tx
          .delete(s.legacySyncSnapshots)
          .where(
            and(
              eq(s.legacySyncSnapshots.userId, actor.userId),
              eq(s.legacySyncSnapshots.entityKind, "goal"),
              eq(s.legacySyncSnapshots.sourceId, goalId),
            ),
          );
      });
    },
    clear(actor: Actor, key: string) {
      return mutate(actor, key, "clear", {}, (tx) => clear(tx, actor));
    },
    editBook(actor: Actor, key: string, input: unknown) {
      const data = bookEditSchema.parse(input);
      return mutate(actor, key, "editBook", data, async (tx) => {
        const [book] = await tx
          .select()
          .from(s.userBooks)
          .where(and(eq(s.userBooks.id, data.userBookId), eq(s.userBooks.userId, actor.userId)));
        if (!book) throw new DomainError("NOT_FOUND", "Book not found.");
        if (book.version !== data.expectedVersion)
          throw new DomainError("VERSION_CONFLICT", "Book changed. Refresh before saving.");
        // Personal corrections never rewrite a shared catalog work.
        const editable = { ...data.metadata };
        for (const name of ["rowanDetails", "legacyImport", "archiveCatalogMappings"]) {
          delete editable[name];
          if (book.legacyMetadata[name] !== undefined) editable[name] = book.legacyMetadata[name];
        }
        await tx
          .update(s.userBooks)
          .set({
            version: book.version + 1,
            legacyMetadata: {
              ...editable,
              rowanDetails: { title: data.title, authors: data.authors, coverUrl: data.coverUrl },
            },
          })
          .where(eq(s.userBooks.id, book.id));
      });
    },
    restore(actor: Actor, key: string, raw: string) {
      const data = parseRowanArchive(raw);
      return mutate(actor, key, "restore", data, async (tx) => {
        await clear(tx, actor);
        const workIds = new Map(data.works.map((w) => [w.id, crypto.randomUUID()]));
        const editionIds = new Map(data.editions.map((e) => [e.id, crypto.randomUUID()]));
        const bookIds = new Map(data.userBooks.map((b) => [b.id, crypto.randomUUID()]));
        const sessionIds = new Map(data.readingSessions.map((s) => [s.id, crypto.randomUUID()]));
        const shelfIds = new Map(data.shelves.map((s) => [s.id, crypto.randomUUID()]));
        // Catalog rows are detached copies: archives cannot overwrite another reader's catalog.
        for (const w of data.works)
          await tx
            .insert(s.works)
            .values({ ...w, id: workIds.get(w.id)!, createdAt: new Date(w.createdAt) });
        for (const e of data.editions)
          await tx
            .insert(s.editions)
            .values({ ...e, id: editionIds.get(e.id)!, workId: workIds.get(e.workId)! });
        for (const b of data.userBooks)
          await tx.insert(s.userBooks).values({
            ...b,
            id: bookIds.get(b.id)!,
            userId: actor.userId,
            workId: workIds.get(b.workId)!,
            selectedEditionId: b.selectedEditionId ? editionIds.get(b.selectedEditionId)! : null,
            addedAt: new Date(b.addedAt),
            version: Math.max(1, b.version),
            legacyMetadata: {
              ...b.legacyMetadata,
              // Retain provider provenance without asserting unverified global identities.
              archiveCatalogMappings: data.externalMappings.some((m) => m.workId === b.workId)
                ? data.externalMappings.filter((m) => m.workId === b.workId)
                : (b.legacyMetadata.archiveCatalogMappings ?? []),
            },
          });
        for (const r of data.readingSessions)
          await tx.insert(s.readingSessions).values({
            ...r,
            timerStartedAt: null,
            id: sessionIds.get(r.id)!,
            userBookId: bookIds.get(r.userBookId)!,
            workId: workIds.get(r.workId)!,
            editionId: r.editionId ? editionIds.get(r.editionId)! : null,
            startedAt: r.startedAt ? new Date(r.startedAt) : null,
            finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
          });
        const entryIds = new Map(
          data.progressEntries.map((entry) => [entry.id, crypto.randomUUID()]),
        );
        for (const r of data.progressEntries)
          await tx.insert(s.progressEntries).values({
            ...r,
            id: entryIds.get(r.id)!,
            supersedesId: r.supersedesId ? entryIds.get(r.supersedesId)! : null,
            readingSessionId: sessionIds.get(r.readingSessionId)!,
            occurredAt: r.occurredAt ? new Date(r.occurredAt) : null,
            createdAt: new Date(r.createdAt),
          });
        for (const r of data.ratings)
          await tx.insert(s.ratings).values({ ...r, userBookId: bookIds.get(r.userBookId)! });
        for (const r of data.margins)
          await tx.insert(s.margins).values({
            ...r,
            id: crypto.randomUUID(),
            userBookId: bookIds.get(r.userBookId)!,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
            deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
          });
        for (const r of data.shelves)
          await tx.insert(s.shelves).values({
            ...r,
            id: shelfIds.get(r.id)!,
            userId: actor.userId,
            createdAt: new Date(r.createdAt),
          });
        for (const r of data.shelfItems)
          await tx.insert(s.shelfItems).values({
            ...r,
            id: crypto.randomUUID(),
            shelfId: shelfIds.get(r.shelfId)!,
            userBookId: bookIds.get(r.userBookId)!,
            userId: actor.userId,
            addedAt: new Date(r.addedAt),
          });
        const seriesIds = new Map(data.series.map((r) => [r.id, crypto.randomUUID()]));
        for (const r of data.series)
          await tx
            .insert(s.readerSeries)
            .values({ ...r, id: seriesIds.get(r.id)!, userId: actor.userId });
        for (const r of data.seriesItems)
          await tx
            .insert(s.readerSeriesItems)
            .values({
              ...r,
              id: crypto.randomUUID(),
              userId: actor.userId,
              seriesId: seriesIds.get(r.seriesId)!,
              userBookId: bookIds.get(r.userBookId)!,
            });
        for (const r of data.readingQueue)
          await tx
            .insert(s.readingQueue)
            .values({ ...r, userId: actor.userId, userBookId: bookIds.get(r.userBookId)! });
        for (const { details, ...r } of data.goals) {
          const goalId = r.id.match(/^rowan:\d+:\d{4}:books$/) ? r.id.replace(/^rowan:\d+:/, `rowan:${actor.userId}:`) : crypto.randomUUID();
          await tx.insert(goals).values({ ...r, id: goalId, userId: actor.userId, createdAt: new Date(r.createdAt) });
          await tx.insert(s.goalDetails).values({ goalId, details });
        }
        const {blackBackground, ...restoredSettings} = data.settings[0] ?? {...defaults,blackBackground:false};
        await tx.insert(userSettings).values({ ...restoredSettings, userId: actor.userId });
        await tx.update(s.accountState).set({blackBackground}).where(eq(s.accountState.userId,actor.userId));
      });
    },
  };
}
