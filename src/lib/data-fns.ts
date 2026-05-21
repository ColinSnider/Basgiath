import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../../server/db";
import { books, margins, goals, userSettings, sessions } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {
  FULL_AUTH_REQUIRED_MESSAGE,
  MISSING_OR_EXPIRED_SESSION_MESSAGE,
  isGuestSessionId,
  isGuestSessionValid,
} from "./session-auth.js";

const nullableText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "null") return null;
    return trimmed;
  });

const importedBookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  coverUrl: nullableText.optional(),
  format: z.enum(["book", "audiobook"]).default("book"),
  totalPages: z.number().int().nonnegative().nullable().optional(),
  currentPage: z.number().int().nonnegative().nullable().optional(),
  durationMinutes: z.number().int().nonnegative().nullable().optional(),
  currentMinute: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["reading", "finished", "wishlist"]),
  addedAt: z.string().datetime(),
  reads: z.array(z.object({ finishedAt: z.string().datetime() })).default([]),
});

const importedMarginSchema = z.object({
  id: z.string().min(1),
  bookId: z.string().min(1),
  type: z.enum(["note", "quote"]),
  text: z.string().min(1),
  page: z.number().int().nonnegative().nullable().optional(),
  createdAt: z.string().datetime(),
});

const importedGoalSchema = z.object({
  id: z.string().min(1),
  metric: z.enum(["books", "pages", "minutes"]),
  target: z.number().int().nonnegative(),
  timeframe: z.enum(["week", "month", "year"]),
  createdAt: z.string().datetime(),
});

async function validateSession(sessionId: string) {
  if (isGuestSessionId(sessionId)) throw new Error(FULL_AUTH_REQUIRED_MESSAGE);
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session || session.expiresAt < new Date())
    throw new Error(MISSING_OR_EXPIRED_SESSION_MESSAGE);
  return session.userId;
}

export const loadData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    if (isGuestSessionId(data.sessionId)) {
      if (!isGuestSessionValid(data.sessionId)) throw new Error(MISSING_OR_EXPIRED_SESSION_MESSAGE);
      return {
        books: [],
        margins: [],
        goals: [],
        settings: {
          userId: 0,
          darkMode: false,
          accentColor: "default",
          compactMode: false,
          fontScale: "md",
        },
      };
    }
    const userId = await validateSession(data.sessionId);
    const [booksData, marginsData, goalsData, settingsRows] = await Promise.all([
      db.select().from(books).where(eq(books.userId, userId)),
      db.select().from(margins).where(eq(margins.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    ]);
    const settings = settingsRows[0] ?? {
      userId,
      darkMode: false,
      accentColor: "default",
      compactMode: false,
      fontScale: "md",
    };
    return { books: booksData, margins: marginsData, goals: goalsData, settings };
  });

export const addBook = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      title: z.string(),
      author: z.string(),
      coverUrl: z.string().optional(),
      format: z.enum(["book", "audiobook"]).default("book"),
      totalPages: z.number().optional(),
      durationMinutes: z.number().optional(),
      status: z.enum(["reading", "finished", "wishlist"]).optional(),
      addedAt: z.string().optional(),
      reads: z.array(z.object({ finishedAt: z.string() })).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const id = crypto.randomUUID();
    const reads = data.reads ?? [];
    const addedAt = data.addedAt ? new Date(data.addedAt) : new Date();
    const [book] = await db
      .insert(books)
      .values({
        id,
        userId,
        title: data.title,
        author: data.author,
        coverUrl: data.coverUrl,
        format: data.format,
        totalPages: data.totalPages,
        durationMinutes: data.durationMinutes,
        currentPage: 0,
        currentMinute: 0,
        status: data.status ?? "reading",
        reads,
        addedAt,
        metadata: data.metadata ?? {},
      })
      .returning();
    return book;
  });

export const updateBook = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      id: z.string(),
      patch: z.object({
        title: z.string().optional(),
        author: z.string().optional(),
        coverUrl: z.string().optional().nullable(),
        totalPages: z.number().optional().nullable(),
        currentPage: z.number().optional(),
        durationMinutes: z.number().optional().nullable(),
        currentMinute: z.number().optional(),
        status: z.enum(["reading", "finished", "wishlist"]).optional(),
        reads: z.array(z.object({ finishedAt: z.string() })).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    await validateSession(data.sessionId);
    const [book] = await db.update(books).set(data.patch).where(eq(books.id, data.id)).returning();
    return book;
  });

export const removeBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), id: z.string() }))
  .handler(async ({ data }) => {
    await validateSession(data.sessionId);
    await db.delete(books).where(eq(books.id, data.id));
    return { ok: true };
  });

export const addMargin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      bookId: z.string(),
      type: z.enum(["note", "quote"]),
      text: z.string(),
      page: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const id = crypto.randomUUID();
    const [margin] = await db
      .insert(margins)
      .values({
        id,
        userId,
        bookId: data.bookId,
        type: data.type,
        text: data.text,
        page: data.page,
      })
      .returning();
    return margin;
  });

export const removeMargin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), id: z.string() }))
  .handler(async ({ data }) => {
    await validateSession(data.sessionId);
    await db.delete(margins).where(eq(margins.id, data.id));
    return { ok: true };
  });

export const addGoal = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      metric: z.enum(["books", "pages", "minutes"]),
      target: z.number(),
      timeframe: z.enum(["week", "month", "year"]),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const id = crypto.randomUUID();
    const [goal] = await db
      .insert(goals)
      .values({
        id,
        userId,
        metric: data.metric,
        target: data.target,
        timeframe: data.timeframe,
      })
      .returning();
    return goal;
  });

export const removeGoal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), id: z.string() }))
  .handler(async ({ data }) => {
    await validateSession(data.sessionId);
    await db.delete(goals).where(eq(goals.id, data.id));
    return { ok: true };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      patch: z.object({
        darkMode: z.boolean().optional(),
        accentColor: z.string().optional(),
        compactMode: z.boolean().optional(),
        fontScale: z.string().optional(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    await db.update(userSettings).set(data.patch).where(eq(userSettings.userId, userId));
    return { ok: true };
  });

export const clearAllData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    await Promise.all([
      db.delete(books).where(eq(books.userId, userId)),
      db.delete(margins).where(eq(margins.userId, userId)),
      db.delete(goals).where(eq(goals.userId, userId)),
    ]);
    return { ok: true };
  });

export const importUserData = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      books: z.array(importedBookSchema),
      margins: z.array(importedMarginSchema),
      goals: z.array(importedGoalSchema),
      settings: z.object({
        darkMode: z.boolean(),
        accentColor: z.string(),
        compactMode: z.boolean(),
        fontScale: z.enum(["sm", "md", "lg"]),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const bookIds = new Set(data.books.map((b) => b.id));
    for (let i = 0; i < data.margins.length; i += 1) {
      const margin = data.margins[i];
      if (!bookIds.has(margin.bookId)) {
        throw new Error(
          `Import failed: margins[${i}] references missing bookId "${margin.bookId}".`,
        );
      }
    }

    await db.transaction(async (tx) => {
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
            currentPage: book.currentPage ?? 0,
            durationMinutes: book.durationMinutes ?? null,
            currentMinute: book.currentMinute ?? 0,
            status: book.status,
            reads: book.reads,
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
        .update(userSettings)
        .set({
          darkMode: data.settings.darkMode,
          accentColor: data.settings.accentColor,
          compactMode: data.settings.compactMode,
          fontScale: data.settings.fontScale,
        })
        .where(eq(userSettings.userId, userId));
    });
    return { ok: true };
  });
