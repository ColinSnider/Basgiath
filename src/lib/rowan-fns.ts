import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { books as legacyBooks, sessions, users } from "../../shared/schema";
import { db } from "../../server/db";
import { getRowanRuntime, rowanEnabled } from "../../server/v2/runtime";
import { DomainError } from "../../server/v2/library-service";
import { importLegacyLibrary } from "../../server/v2/legacy-import";

const key = z.string().uuid();
const moment = z.string().datetime({ offset: true });
const command = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("edition"),
      key,
      userBookId: key,
      expectedVersion: z.number().int().nonnegative(),
      format: z.enum(["book", "ebook", "audiobook"]),
      total: z.number().int().positive().max(10000000).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("annualGoal"),
      key,
      year: z.number().int().min(1900).max(9998),
      target: z.number().int().min(1).max(10000),
    })
    .strict(),
  z
    .object({
      type: z.literal("manual"),
      key,
      title: z.string().trim().min(1).max(500),
      author: z.string().trim().max(300),
      format: z.enum(["book", "ebook", "audiobook"]),
      total: z.number().int().positive().max(10000000).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("margin"),
      key,
      userBookId: key,
      marginId: key,
      expectedVersion: z.number().int().nonnegative().nullable(),
      action: z.enum(["save", "delete"]),
      body: z.string().trim().min(1).max(10000).optional(),
      locator: z.string().trim().max(120).nullable().optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("shelfCreate"), key, name: z.string().trim().min(1).max(120) })
    .strict(),
  z
    .object({
      type: z.literal("shelfRename"),
      key,
      shelfId: key,
      name: z.string().trim().min(1).max(120),
      expectedVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("shelfItem"),
      key,
      shelfId: key,
      userBookId: key,
      present: z.boolean(),
      expectedVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("personalize"),
      key,
      userBookId: key,
      expectedVersion: z.number().int().nonnegative(),
      isFavorite: z.boolean().optional(),
      halfStars: z.number().int().min(1).max(10).nullable().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("save"),
      key,
      ref: z.union([
        z.object({
          provider: z.literal("openlibrary"),
          externalId: z.string().regex(/^\/works\/OL\d+W$/),
        }),
        z.object({
          provider: z.literal("googlebooks"),
          externalId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        }),
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("start"),
      key,
      userBookId: key,
      expectedVersion: z.number().int().nonnegative(),
      startedAt: moment.nullable(),
      unit: z.enum(["page", "second", "percent"]),
      position: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("progress"),
      key,
      sessionId: key,
      expectedVersion: z.number().int().nonnegative(),
      occurredAt: moment,
      position: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("transition"),
      key,
      sessionId: key,
      expectedVersion: z.number().int().nonnegative(),
      occurredAt: moment.nullable(),
      action: z.enum(["pause", "resume", "finish", "dnf"]),
    })
    .strict(),
]);
export type RowanCommand = z.infer<typeof command>;

async function context(sessionId: string, importLibrary = true) {
  const runtime = getRowanRuntime();
  // Existing login is read-only here; personal v2 writes use the separate database.
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session || session.expiresAt <= new Date())
    throw new Error("Sign in to the development account again.");
  if (!importLibrary) return { ...runtime, actor: { userId: session.userId } };
  const [source] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!source) throw new Error("The signed-in staging account could not be found.");
  const legacyRows = await db
    .select()
    .from(legacyBooks)
    .where(eq(legacyBooks.userId, session.userId));
  await importLegacyLibrary(runtime.database, source, legacyRows);
  return { ...runtime, actor: { userId: session.userId } };
}
export const rowanStatus = createServerFn({ method: "GET" }).handler(() => ({
  enabled: rowanEnabled(),
  googleBooksEnabled:
    process.env.GOOGLE_BOOKS_ENABLED === "true" && !!process.env.GOOGLE_BOOKS_API_KEY?.trim(),
}));
export const rowanLibrary = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        sessionId: key,
        offset: z.number().int().nonnegative(),
        query: z.string().max(200),
        status: z.string(),
        favoritesOnly: z.boolean().optional(),
        shelfId: key.optional(),
        sort: z.enum(["newest", "oldest", "title", "rating"]).optional(),
      })
      .strict(),
  )
  .handler(async ({ data: { sessionId, ...input } }) => {
    const { library, actor } = await context(sessionId);
    return library.libraryPage(actor, input);
  });
export const rowanSearch = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        sessionId: key,
        query: z.string().trim().min(1).max(200),
        source: z.enum(["openlibrary", "googlebooks"]).default("openlibrary"),
      })
      .strict(),
  )
  .handler(async ({ data }) => {
    const { provider } = await context(data.sessionId, false);
    return provider.search(data.query, data.source);
  });
export const rowanInsights = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, year: z.number().int().min(1900).max(9998) }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    return library.insights(actor, data.year);
  });
export const rowanArchive = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    return library.archive(actor);
  });
export const rowanJournal = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        sessionId: key,
        query: z.string().max(200),
        offset: z.number().int().min(0).max(100000),
      })
      .strict(),
  )
  .handler(async ({ data: { sessionId, ...input } }) => {
    const { library, actor } = await context(sessionId);
    return library.marginJournal(actor, input);
  });
export const rowanShelves = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    const { shelfService, actor } = await context(data.sessionId);
    return (await shelfService.list(actor)).map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      version: shelf.version,
    }));
  });
export const rowanHome = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    return library.home(actor);
  });
export const rowanCalendar = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, from: moment, to: moment }).strict())
  .handler(async ({ data: { sessionId, ...range } }) => {
    const { library, actor } = await context(sessionId);
    return library.calendar(actor, range);
  });
export const rowanHistory = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, userBookId: key }).strict())
  .handler(async ({ data }) => {
    const { library, shelfService, actor } = await context(data.sessionId);
    const history = await library.readingHistory(actor, data.userBookId);
    return {
      shelfIds: (await shelfService.membership(actor, data.userBookId)).map((item) => item.shelfId),
      userBookVersion: history.userBookVersion,
      edition: history.edition,
      margins: history.margins.map((margin) => ({
        ...margin,
        createdAt: margin.createdAt.toISOString(),
        updatedAt: margin.updatedAt.toISOString(),
      })),
      isFavorite: history.isFavorite,
      halfStars: history.halfStars,
      sessions: history.sessions.map((s) => ({
        id: s.id,
        state: s.state,
        unit: s.unit,
        total: s.total,
        position: s.position,
        version: s.version,
        startedAt: s.startedAt?.toISOString() ?? null,
        finishedAt: s.finishedAt?.toISOString() ?? null,
      })),
      entries: history.entries.map((e) => ({
        id: e.id,
        sessionId: e.readingSessionId,
        kind: e.kind,
        position: e.position,
        occurredAt: e.occurredAt?.toISOString() ?? null,
      })),
    };
  });
export const rowanMutate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, command }).strict())
  .handler(async ({ data }) => {
    const { library, shelfService, actor } = await context(data.sessionId);
    try {
      // Narrow the discriminated union before passing validated commands to the domain.
      switch (data.command.type) {
        case "edition": {
          const { type, ...value } = data.command;
          await library.setEdition(actor, value);
          break;
        }
        case "annualGoal": {
          const { type, ...value } = data.command;
          await library.setAnnualGoal(actor, value);
          break;
        }
        case "manual": {
          const { type, ...value } = data.command;
          await library.saveManual(actor, value);
          break;
        }
        case "margin": {
          const { type, ...value } = data.command;
          await library.changeMargin(actor, value);
          break;
        }
        case "shelfCreate": {
          const { type, ...value } = data.command;
          await shelfService.create(actor, value);
          break;
        }
        case "shelfRename": {
          const { type, ...value } = data.command;
          await shelfService.rename(actor, value);
          break;
        }
        case "shelfItem": {
          const { type, ...value } = data.command;
          await shelfService.setItem(actor, value);
          break;
        }
        case "personalize": {
          const { type, ...value } = data.command;
          await library.personalize(actor, value);
          break;
        }
        case "save": {
          const { type, ...value } = data.command;
          await library.saveWork(actor, value);
          break;
        }
        case "start": {
          const { type, ...value } = data.command;
          await library.startReading(actor, value);
          break;
        }
        case "progress": {
          const { type, ...value } = data.command;
          await library.recordProgress(actor, value);
          break;
        }
        case "transition": {
          const { type, ...value } = data.command;
          await library.transitionReading(actor, value);
          break;
        }
      }
      return { ok: true as const };
    } catch (error) {
      if (error instanceof DomainError)
        return { ok: false as const, code: error.code, message: error.message };
      throw new Error("Rowan could not save this change. Retry the same request.");
    }
  });
