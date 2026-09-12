import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { db } from "../db.ts";
import { DomainError, type Actor } from "./library-service.ts";
import { mutationReceipts, shelves, shelfItems, userBooks } from "../../shared/schema-v2.ts";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const id = z.string().uuid();
const version = z.number().int().nonnegative();
const name = z.string().trim().min(1).max(120);

export type ShelfMutationResult = {
  shelfId: string;
  userBookId: string | null;
  version: number;
};

const resultSchema = z.object({ shelfId: id, userBookId: id.nullable(), version });

function hash(operation: string, data: object) {
  return createHash("sha256").update(JSON.stringify({ operation, data })).digest("hex");
}

function owner(actor: Actor) {
  z.number().int().positive().parse(actor.userId);
}

export function createShelfService(database: Database) {
  async function mutate(
    actor: Actor,
    key: string,
    fingerprint: string,
    action: (tx: Transaction) => Promise<ShelfMutationResult>,
  ) {
    owner(actor);
    return database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(21071, ${actor.userId})`);
      const [receipt] = await tx
        .select()
        .from(mutationReceipts)
        .where(and(eq(mutationReceipts.userId, actor.userId), eq(mutationReceipts.key, key)));
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new DomainError(
            "IDEMPOTENCY_CONFLICT",
            "This request key was already used for different data.",
          );
        return resultSchema.parse(receipt.result);
      }
      const result = await action(tx);
      await tx.insert(mutationReceipts).values({
        userId: actor.userId,
        key,
        fingerprint,
        result,
      });
      return result;
    });
  }

  async function ownedShelf(tx: Transaction, actor: Actor, shelfId: string) {
    const [shelf] = await tx
      .select()
      .from(shelves)
      .where(and(eq(shelves.id, shelfId), eq(shelves.userId, actor.userId)))
      .for("update");
    if (!shelf) throw new DomainError("NOT_FOUND", "Shelf not found.");
    return shelf;
  }

  return {
    async create(actor: Actor, input: { key: string; name: string }) {
      const data = z.object({ key: id, name }).strict().parse(input);
      return mutate(actor, data.key, hash("shelf.create", data), async (tx) => {
        const [duplicate] = await tx
          .select({ id: shelves.id })
          .from(shelves)
          .where(and(eq(shelves.userId, actor.userId), eq(shelves.name, data.name)));
        if (duplicate)
          throw new DomainError("INVALID_TRANSITION", "A shelf with this name already exists.");
        const [shelf] = await tx
          .insert(shelves)
          .values({ userId: actor.userId, name: data.name, sortOrder: sql`(select coalesce(max(sort_order), -1) + 1 from v2.shelves where user_id = ${actor.userId})` })
          .returning();
        return { shelfId: shelf.id, userBookId: null, version: shelf.version };
      });
    },

    async rename(
      actor: Actor,
      input: { key: string; shelfId: string; name: string; description?: string; expectedVersion: number },
    ) {
      const data = z
        .object({ key: id, shelfId: id, name, description: z.string().trim().max(1000).optional(), expectedVersion: version })
        .strict()
        .parse(input);
      return mutate(actor, data.key, hash("shelf.rename", data), async (tx) => {
        const shelf = await ownedShelf(tx, actor, data.shelfId);
        if (shelf.version !== data.expectedVersion)
          throw new DomainError(
            "VERSION_CONFLICT",
            "The shelf changed. Refresh before saving again.",
          );
        const [duplicate] = await tx
          .select({ id: shelves.id })
          .from(shelves)
          .where(and(eq(shelves.userId, actor.userId), eq(shelves.name, data.name)));
        if (duplicate && duplicate.id !== shelf.id)
          throw new DomainError("INVALID_TRANSITION", "A shelf with this name already exists.");
        const nextVersion = shelf.version + 1;
        await tx
          .update(shelves)
          .set({ name: data.name, description: data.description ?? shelf.description, version: nextVersion })
          .where(eq(shelves.id, shelf.id));
        return { shelfId: shelf.id, userBookId: null, version: nextVersion };
      });
    },

    async setItem(
      actor: Actor,
      input: {
        key: string;
        shelfId: string;
        userBookId: string;
        present: boolean;
        expectedVersion: number;
      },
    ) {
      const data = z
        .object({
          key: id,
          shelfId: id,
          userBookId: id,
          present: z.boolean(),
          expectedVersion: version,
        })
        .strict()
        .parse(input);
      return mutate(actor, data.key, hash("shelf.item", data), async (tx) => {
        const shelf = await ownedShelf(tx, actor, data.shelfId);
        if (shelf.version !== data.expectedVersion)
          throw new DomainError(
            "VERSION_CONFLICT",
            "The shelf changed. Refresh before saving again.",
          );
        const [book] = await tx
          .select({ id: userBooks.id })
          .from(userBooks)
          .where(and(eq(userBooks.id, data.userBookId), eq(userBooks.userId, actor.userId)));
        if (!book) throw new DomainError("NOT_FOUND", "Book not found.");
        const [existing] = await tx
          .select()
          .from(shelfItems)
          .where(and(eq(shelfItems.shelfId, shelf.id), eq(shelfItems.userBookId, book.id)));
        if (data.present && !existing)
          await tx
            .insert(shelfItems)
            .values({ shelfId: shelf.id, userId: actor.userId, userBookId: book.id, sortOrder: sql`(select coalesce(max(sort_order), -1) + 1 from v2.shelf_items where shelf_id = ${shelf.id})` });
        if (!data.present && existing)
          await tx.delete(shelfItems).where(eq(shelfItems.id, existing.id));
        const changed = data.present !== Boolean(existing);
        const nextVersion = changed ? shelf.version + 1 : shelf.version;
        if (changed)
          await tx.update(shelves).set({ version: nextVersion }).where(eq(shelves.id, shelf.id));
        return { shelfId: shelf.id, userBookId: book.id, version: nextVersion };
      });
    },

    async manage(actor: Actor, input: {key: string; shelfId: string; expectedVersion: number; action: "delete" | "up" | "down"; userBookId?: string}) {
      const data = z.object({key: id, shelfId: id, expectedVersion: version, action: z.enum(["delete", "up", "down"]), userBookId: id.optional()}).strict().parse(input);
      return mutate(actor, data.key, hash("shelf.manage", data), async tx => {
        const shelf = await ownedShelf(tx, actor, data.shelfId);
        if (shelf.version !== data.expectedVersion) throw new DomainError("VERSION_CONFLICT", "The shelf changed. Refresh before saving again.");
        if (data.action === "delete") {
          if (data.userBookId) throw new DomainError("INVALID_TRANSITION", "Delete applies to a shelf, not a book.");
          await tx.delete(shelfItems).where(eq(shelfItems.shelfId, shelf.id));
          await tx.delete(shelves).where(eq(shelves.id, shelf.id));
        } else if (data.userBookId) {
          const items = await tx.select().from(shelfItems).where(eq(shelfItems.shelfId, shelf.id)).orderBy(shelfItems.sortOrder, shelfItems.addedAt, shelfItems.id);
          const index = items.findIndex(item => item.userBookId === data.userBookId);
          if (index < 0) throw new DomainError("NOT_FOUND", "Book is not on this shelf.");
          const target = index + (data.action === "up" ? -1 : 1);
          if (target >= 0 && target < items.length) [items[index], items[target]] = [items[target], items[index]];
          for (const [position, item] of items.entries()) await tx.update(shelfItems).set({sortOrder: position}).where(eq(shelfItems.id, item.id));
          await tx.update(shelves).set({version: shelf.version + 1}).where(eq(shelves.id, shelf.id));
        } else {
          const items = await tx.select().from(shelves).where(eq(shelves.userId, actor.userId)).orderBy(shelves.sortOrder, shelves.createdAt, shelves.id);
          const index = items.findIndex(item => item.id === shelf.id);
          const target = index + (data.action === "up" ? -1 : 1);
          if (target >= 0 && target < items.length) [items[index], items[target]] = [items[target], items[index]];
          for (const [position, item] of items.entries()) await tx.update(shelves).set({sortOrder: position, version: item.version + 1}).where(eq(shelves.id, item.id));
        }
        return {shelfId: shelf.id, userBookId: data.userBookId ?? null, version: shelf.version + 1};
      });
    },

    async list(actor: Actor) {
      owner(actor);
      return database
        .select()
        .from(shelves)
        .where(eq(shelves.userId, actor.userId))
        .orderBy(shelves.sortOrder, shelves.createdAt, shelves.id);
    },

    async membership(actor: Actor, userBookId: string) {
      owner(actor);
      id.parse(userBookId);
      return database
        .select({ shelfId: shelfItems.shelfId })
        .from(shelfItems)
        .innerJoin(shelves, eq(shelves.id, shelfItems.shelfId))
        .where(and(eq(shelfItems.userBookId, userBookId), eq(shelves.userId, actor.userId)));
    },
  };
}
