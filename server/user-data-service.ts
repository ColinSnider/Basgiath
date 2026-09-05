import { and, eq } from "drizzle-orm";
import type { db } from "./db.ts";
import { books, margins, goals, userSettings } from "../shared/schema.ts";
import { importDataSchema } from "../src/lib/import-contract.ts";

// Session validation remains at the transport boundary; actor IDs are server-derived.
export function createUserDataService(database: typeof db) {
  function requireRow<T>(row: T | undefined): T {
    if (!row) throw new Error("Record not found.");
    return row;
  }
  return {
    async exportUserData(userId: number) {
      return database.transaction(
        async (tx) => {
          const booksData = await tx.select().from(books).where(eq(books.userId, userId));
          const marginsData = await tx.select().from(margins).where(eq(margins.userId, userId));
          const goalsData = await tx.select().from(goals).where(eq(goals.userId, userId));
          const [settings] = await tx
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, userId));
          return {
            books: booksData,
            margins: marginsData,
            goals: goalsData,
            settings: settings ?? {
              userId,
              darkMode: false,
              accentColor: "default",
              compactMode: false,
              fontScale: "md",
            },
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
    async finishRead(userId: number, id: string, finishedAt: string) {
      return database.transaction(async (tx) => {
        const [book] = await tx
          .select()
          .from(books)
          .where(and(eq(books.id, id), eq(books.userId, userId)))
          .for("update");
        requireRow(book);
        // A new reading attempt must first transition back to reading.
        if (book.status === "finished" && book.reads.length > 0) return book;
        const [updated] = await tx
          .update(books)
          .set({
            status: "finished",
            reads: [...book.reads, { finishedAt }],
            ...(book.format === "audiobook"
              ? { currentMinute: book.durationMinutes ?? book.currentMinute }
              : { currentPage: book.totalPages ?? book.currentPage }),
          })
          .where(and(eq(books.id, id), eq(books.userId, userId)))
          .returning();
        return updated;
      });
    },
    async updateBook(
      userId: number,
      id: string,
      patch: Partial<Omit<typeof books.$inferInsert, "id" | "userId">>,
    ) {
      const [row] = await database
        .update(books)
        .set(patch)
        .where(and(eq(books.id, id), eq(books.userId, userId)))
        .returning();
      return requireRow(row);
    },
    async removeBook(userId: number, id: string) {
      const [row] = await database
        .delete(books)
        .where(and(eq(books.id, id), eq(books.userId, userId)))
        .returning({ id: books.id });
      requireRow(row);
    },
    async removeMargin(userId: number, id: string) {
      const [row] = await database
        .delete(margins)
        .where(and(eq(margins.id, id), eq(margins.userId, userId)))
        .returning({ id: margins.id });
      requireRow(row);
    },
    async removeGoal(userId: number, id: string) {
      const [row] = await database
        .delete(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .returning({ id: goals.id });
      requireRow(row);
    },
    async addMargin(
      userId: number,
      data: { bookId: string; type: string; text: string; page?: number },
    ) {
      return database.transaction(async (tx) => {
        // Lock the parent until insertion completes; deletes cannot race the ownership check.
        const [parent] = await tx
          .select({ id: books.id })
          .from(books)
          .where(and(eq(books.id, data.bookId), eq(books.userId, userId)))
          .for("key share");
        requireRow(parent);
        const [row] = await tx
          .insert(margins)
          .values({
            id: crypto.randomUUID(),
            userId,
            bookId: data.bookId,
            type: data.type,
            text: data.text,
            page: data.page,
          })
          .returning();
        return row;
      });
    },
    async updateSettings(
      userId: number,
      patch: Partial<Omit<typeof userSettings.$inferInsert, "userId">>,
    ) {
      // Empty patches still materialize defaults without generating an empty SQL SET.
      await database
        .insert(userSettings)
        .values({ userId, ...patch })
        .onConflictDoUpdate({ target: userSettings.userId, set: { userId, ...patch } });
    },
    async clearAllData(userId: number) {
      await database.transaction(async (tx) => {
        await tx.delete(margins).where(eq(margins.userId, userId));
        await tx.delete(goals).where(eq(goals.userId, userId));
        await tx.delete(books).where(eq(books.userId, userId));
      });
    },
    async importUserData(userId: number, input: unknown) {
      // Validate here too, so every future caller gets pre-deletion validation.
      const data = importDataSchema.parse(input);
      await database.transaction(async (tx) => {
        await tx.delete(margins).where(eq(margins.userId, userId));
        await tx.delete(goals).where(eq(goals.userId, userId));
        await tx.delete(books).where(eq(books.userId, userId));

        if (data.books.length) {
          await tx.insert(books).values(
            data.books.map((book) => ({
              id: book.id,
              userId,
              title: book.title,
              author: book.author,
              coverUrl: book.coverUrl ?? null,
              format: book.format,
              totalPages: book.totalPages ?? null,
              currentPage: book.currentPage === undefined ? 0 : book.currentPage,
              durationMinutes: book.durationMinutes ?? null,
              currentMinute: book.currentMinute === undefined ? 0 : book.currentMinute,
              status: book.status,
              reads: book.reads,
              metadata: book.metadata,
              addedAt: new Date(book.addedAt),
            })),
          );
        }

        if (data.margins.length) {
          await tx.insert(margins).values(
            data.margins.map((margin) => ({
              id: margin.id,
              userId,
              bookId: margin.bookId,
              type: margin.type,
              text: margin.text,
              page: margin.page ?? null,
              createdAt: new Date(margin.createdAt),
            })),
          );
        }

        if (data.goals.length) {
          await tx.insert(goals).values(
            data.goals.map((goal) => ({
              id: goal.id,
              userId,
              metric: goal.metric,
              target: goal.target,
              timeframe: goal.timeframe,
              createdAt: new Date(goal.createdAt),
            })),
          );
        }

        await tx
          .insert(userSettings)
          .values({ userId, ...data.settings })
          .onConflictDoUpdate({ target: userSettings.userId, set: data.settings });
      });
    },
  };
}
