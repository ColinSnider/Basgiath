import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../../server/db";
import { books, margins, goals, userSettings, sessions } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function validateSession(sessionId: string) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session || session.expiresAt < new Date()) throw new Error("Unauthorized");
  return session.userId;
}

export const loadData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const [booksData, marginsData, goalsData, settingsRows] = await Promise.all([
      db.select().from(books).where(eq(books.userId, userId)),
      db.select().from(margins).where(eq(margins.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    ]);
    const settings = settingsRows[0] ?? { userId, darkMode: false, accentColor: "default", compactMode: false, fontScale: "md" };
    return { books: booksData, margins: marginsData, goals: goalsData, settings };
  });

export const addBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({
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
  }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const id = crypto.randomUUID();
    const reads = data.reads ?? [];
    const addedAt = data.addedAt ? new Date(data.addedAt) : new Date();
    const [book] = await db.insert(books).values({
      id, userId,
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
    }).returning();
    return book;
  });

export const updateBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({
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
    }),
  }))
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
  .inputValidator(z.object({
    sessionId: z.string(),
    bookId: z.string(),
    type: z.enum(["note", "quote"]),
    text: z.string(),
    page: z.number().optional(),
  }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const id = crypto.randomUUID();
    const [margin] = await db.insert(margins).values({
      id, userId,
      bookId: data.bookId,
      type: data.type,
      text: data.text,
      page: data.page,
    }).returning();
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
  .inputValidator(z.object({
    sessionId: z.string(),
    metric: z.enum(["books", "pages", "minutes"]),
    target: z.number(),
    timeframe: z.enum(["week", "month", "year"]),
  }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    const id = crypto.randomUUID();
    const [goal] = await db.insert(goals).values({
      id, userId,
      metric: data.metric,
      target: data.target,
      timeframe: data.timeframe,
    }).returning();
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
  .inputValidator(z.object({
    sessionId: z.string(),
    patch: z.object({
      darkMode: z.boolean().optional(),
      accentColor: z.string().optional(),
      compactMode: z.boolean().optional(),
      fontScale: z.string().optional(),
    }),
  }))
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
