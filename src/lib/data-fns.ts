import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importDataSchema, jsonValueSchema } from "./import-contract";
import { createUserDataService } from "../../server/user-data-service";
import { db } from "../../server/db";
import { books, margins, goals, userSettings, sessions } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {
  FULL_AUTH_REQUIRED_MESSAGE,
  MISSING_OR_EXPIRED_SESSION_MESSAGE,
  isGuestSessionId,
  isGuestSessionValid,
} from "./session-auth.js";

const userData = createUserDataService(db);

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
      status: z.enum(["reading", "finished", "wishlist", "dnf"]).optional(),
      addedAt: z.string().optional(),
      reads: z.array(z.object({ finishedAt: z.string() })).optional(),
      metadata: z.record(z.string(), jsonValueSchema).optional(),
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
        currentPage: z.number().nullable().optional(),
        durationMinutes: z.number().optional().nullable(),
        currentMinute: z.number().nullable().optional(),
        status: z.enum(["reading", "finished", "wishlist", "dnf"]).optional(),
        reads: z.array(z.object({ finishedAt: z.string() })).optional(),
        metadata: z.record(z.string(), jsonValueSchema).optional(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    return userData.updateBook(userId, data.id, data.patch);
  });

export const removeBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), id: z.string() }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    await userData.removeBook(userId, data.id);
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
    return userData.addMargin(userId, data);
  });

export const removeMargin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string(), id: z.string() }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    await userData.removeMargin(userId, data.id);
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
    const userId = await validateSession(data.sessionId);
    await userData.removeGoal(userId, data.id);
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
    await userData.updateSettings(userId, data.patch);
    return { ok: true };
  });

export const clearAllData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    await userData.clearAllData(userId);
    return { ok: true };
  });

export const importUserData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }).and(importDataSchema))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    await userData.importUserData(userId, data);
    return { ok: true };
  });

export const finishRead = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string(),
      id: z.string(),
      finishedAt: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    return userData.finishRead(userId, data.id, data.finishedAt ?? new Date().toISOString());
  });

export const exportUserData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const userId = await validateSession(data.sessionId);
    return userData.exportUserData(userId);
  });
