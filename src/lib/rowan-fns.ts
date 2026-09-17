import { goalMetricSchema, goalLogSchema } from "../../shared/goal-settings";
import { createOrganizationService } from "../../server/v2/organization-service";
import { browseFields, browseSort } from "../../shared/library-browse";
import { backlogImport, historyChange } from "../../shared/backlog";
import { organizationCommand } from "../../shared/reading-organization";
import { createAccountService } from "../../server/v2/account-service";
import { bookEditSchema, settingsSchema, goalTimeframeSchema } from "../../shared/rowan-archive";
import { importDataSchema } from "./import-contract";
import { createUserDataService } from "../../server/user-data-service";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { books as legacyBooks, sessions, users } from "../../shared/schema";
import { db } from "../../server/db";
import { getRowanRuntime, rowanEnabled } from "../../server/v2/runtime";
import { DomainError } from "../../server/v2/library-service";
import { importLegacyLibrary } from "../../server/v2/legacy-import";
import { qualitySearch } from "../../server/v2/search-quality";
import { margins as legacyMargins, goals as legacyGoals, userSettings } from "../../shared/schema";
import {
  userBooks as v2Books,
  margins as v2Margins,
  shelves as v2Shelves,
  shelfItems as v2ShelfItems,
  legacySyncSnapshots,
  accountState,
} from "../../shared/schema-v2";
import { count } from "drizzle-orm";
import { createHash } from "node:crypto";

const key = z.string().uuid();
const moment = z.string().datetime({ offset: true });
const command = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("syncCatalog"),
      source: z.enum(["googlebooks", "openlibrary"]),
      externalId: z.string().min(1).max(128),
      key,
      userBookId: key,
      expectedVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal("history"), payload: historyChange }).strict(),
  z.object({ type: z.literal("backlogImport"), payload: backlogImport }).strict(),
  z
    .object({
      type: z.literal("timer"),
      key,
      sessionId: key,
      expectedVersion: z.number().int().nonnegative(),
      action: z.enum(["start", "stop"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("correctProgress"),
      key,
      sessionId: key,
      entryId: key,
      expectedVersion: z.number().int().nonnegative(),
      action: z.enum(["correct", "remove"]),
      position: z.number().int().nonnegative(),
      occurredAt: moment,
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
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
      kind: z.enum(["note", "quote"]).optional(),
      body: z
        .string()
        .max(10000)
        .refine((value) => value.trim().length > 0, "A margin needs text.")
        .optional(),
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
      description: z.string().trim().max(1000).optional(),
      expectedVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      type: z.literal("shelfManage"),
      key,
      shelfId: key,
      expectedVersion: z.number().int().nonnegative(),
      action: z.enum(["delete", "up", "down"]),
      userBookId: key.optional(),
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
      tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
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
  if (process.env.ROWAN_STANDALONE === "true") {
    const [state] = await runtime.database
      .select()
      .from(accountState)
      .where(eq(accountState.userId, session.userId));
    if (state?.mirrorPaused) return { ...runtime, actor: { userId: session.userId } };
  }
  const [source] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, session.userId));
  if (!source) throw new Error("The signed-in staging account could not be found.");
  const legacyRows = await db
    .select()
    .from(legacyBooks)
    .where(eq(legacyBooks.userId, session.userId));
  const [legacyMarginRows, legacyGoalRows, legacySettingRows] = await Promise.all([
    db.select().from(legacyMargins).where(eq(legacyMargins.userId, session.userId)),
    db.select().from(legacyGoals).where(eq(legacyGoals.userId, session.userId)),
    db.select().from(userSettings).where(eq(userSettings.userId, session.userId)),
  ]);
  await importLegacyLibrary(
    runtime.database,
    source,
    legacyRows,
    legacyMarginRows,
    legacyGoalRows,
    legacySettingRows[0],
    process.env.ROWAN_STANDALONE === "true",
  );
  return { ...runtime, actor: { userId: session.userId } };
}
export const rowanStatus = createServerFn({ method: "GET" }).handler(() => ({
  enabled: rowanEnabled(),
  googleBooksEnabled:
    !!process.env.GOOGLE_BOOKS_API_KEY?.trim(),
}));
const accountCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("settings"), key, settings: settingsSchema }).strict(),
  z
    .object({
      type: z.literal("deleteBook"),
      key,
      userBookId: key,
      expectedVersion: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ type: z.literal("deleteGoal"), key, goalId: z.string().min(1) }).strict(),
  z.object({ type: z.literal("clear"), key, confirmation: z.literal("CLEAR") }).strict(),
  z
    .object({
      type: z.literal("restore"),
      key,
      raw: z.string().max(20 * 1024 * 1024),
      confirmation: z.literal("RESTORE"),
    })
    .strict(),
  bookEditSchema.extend({ type: z.literal("editBook"), key }),
]);
export type RowanAccountCommand = z.infer<typeof accountCommand>;
export const rowanSettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    const { actor, database } = await context(data.sessionId);
    return createAccountService(database).settings(actor);
  });
export const rowanAccountMutate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, command: accountCommand }).strict())
  .handler(async ({ data }) => {
    const { actor, database } = await context(data.sessionId);
    const service = createAccountService(database);
    const c = data.command;
    try {
      switch (c.type) {
        case "settings":
          return await service.saveSettings(actor, c.key, c.settings);
        case "deleteBook":
          return await service.deleteBook(actor, c.key, {
            userBookId: c.userBookId,
            expectedVersion: c.expectedVersion,
          });
        case "deleteGoal":
          return await service.deleteGoal(actor, c.key, c.goalId);
        case "clear":
          return await service.clear(actor, c.key);
        case "restore":
          return await service.restore(actor, c.key, c.raw);
        case "editBook": {
          const { type: _type, key: requestKey, ...input } = c;
          return await service.editBook(actor, requestKey, input);
        }
      }
    } catch (error) {
      if (error instanceof DomainError) return { ok: false as const, message: error.message };
      if (
        error instanceof z.ZodError ||
        error instanceof SyntaxError ||
        (error instanceof Error && error.message.startsWith("Invalid archive:"))
      )
        return {
          ok: false as const,
          message: "The supplied data is invalid. No changes were saved.",
        };
      throw new Error("The result could not be confirmed. Retry the same request.");
    }
  });
export const rowanImportLegacy = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, data: importDataSchema }).strict())
  .handler(async ({ data }) => {
    const { database, actor } = await context(data.sessionId, false);
    const userData = createUserDataService(db);
    await userData.importUserData(actor.userId, data.data);
    const [source] = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, actor.userId));
    if (!source) throw new Error("The signed-in Rowan account could not be found.");
    const [books, margins, goals, settings] = await Promise.all([
      db.select().from(legacyBooks).where(eq(legacyBooks.userId, actor.userId)),
      db.select().from(legacyMargins).where(eq(legacyMargins.userId, actor.userId)),
      db.select().from(legacyGoals).where(eq(legacyGoals.userId, actor.userId)),
      db.select().from(userSettings).where(eq(userSettings.userId, actor.userId)),
    ]);
    await importLegacyLibrary(database, source, books, margins, goals, settings[0], true, true);
    return {
      ok: true as const,
      books: data.data.books.length,
      margins: data.data.margins.length,
      goals: data.data.goals.length,
    };
  });
export const rowanSyncStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    if (process.env.ROWAN_STANDALONE === "true")
      throw new Error("Legacy synchronization is unavailable in standalone Rowan.");
    const runtime = getRowanRuntime();
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt <= new Date())
      throw new Error("Sign in to the development account again.");
    const userId = session.userId;
    const [
      [legacyBookCount],
      [legacyMarginCount],
      [legacyGoalCount],
      [v2BookCount],
      [v2MarginCount],
      [v2GoalCount],
      [v2ShelfCount],
    ] = await Promise.all([
      db.select({ count: count() }).from(legacyBooks).where(eq(legacyBooks.userId, userId)),
      db.select({ count: count() }).from(legacyMargins).where(eq(legacyMargins.userId, userId)),
      db.select({ count: count() }).from(legacyGoals).where(eq(legacyGoals.userId, userId)),
      runtime.database.select({ count: count() }).from(v2Books).where(eq(v2Books.userId, userId)),
      runtime.database
        .select({ count: count() })
        .from(v2Margins)
        .innerJoin(v2Books, eq(v2Books.id, v2Margins.userBookId))
        .where(eq(v2Books.userId, userId)),
      runtime.database
        .select({ count: count() })
        .from(legacyGoals)
        .where(eq(legacyGoals.userId, userId)),
      runtime.database
        .select({ count: count() })
        .from(v2Shelves)
        .where(eq(v2Shelves.userId, userId)),
    ]);
    return {
      legacy: {
        books: legacyBookCount.count,
        margins: legacyMarginCount.count,
        goals: legacyGoalCount.count,
      },
      v2: {
        books: v2BookCount.count,
        margins: v2MarginCount.count,
        goals: v2GoalCount.count,
        shelves: v2ShelfCount.count,
      },
      checkedAt: new Date().toISOString(),
    };
  });
export const rowanSyncConflicts = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    if (process.env.ROWAN_STANDALONE === "true")
      throw new Error("Legacy synchronization is unavailable in standalone Rowan.");
    const runtime = getRowanRuntime();
    const [session] = await db.select().from(sessions).where(eq(sessions.id, data.sessionId));
    if (!session || session.expiresAt <= new Date())
      throw new Error("Sign in to the development account again.");
    const userId = session.userId;
    const [sourceBooks, sourceMargins, sourceGoals, sourceSettings, snapshots] = await Promise.all([
      db.select().from(legacyBooks).where(eq(legacyBooks.userId, userId)),
      db.select().from(legacyMargins).where(eq(legacyMargins.userId, userId)),
      db.select().from(legacyGoals).where(eq(legacyGoals.userId, userId)),
      db.select().from(userSettings).where(eq(userSettings.userId, userId)),
      runtime.database
        .select()
        .from(legacySyncSnapshots)
        .where(eq(legacySyncSnapshots.userId, userId)),
    ]);
    const hash = (value: unknown) =>
      createHash("sha256").update(JSON.stringify(value)).digest("hex");
    const source = [
      ...sourceBooks.map((row) => ({ kind: "book" as const, id: row.id, value: row })),
      ...sourceMargins.map((row) => ({ kind: "margin" as const, id: row.id, value: row })),
      ...sourceGoals.map((row) => ({ kind: "goal" as const, id: row.id, value: row })),
      ...(sourceSettings[0]
        ? [{ kind: "settings" as const, id: String(userId), value: sourceSettings[0] }]
        : []),
    ];
    const known = new Map(snapshots.map((row) => [`${row.entityKind}:${row.sourceId}`, row]));
    const changed = source
      .filter((row) => known.get(`${row.kind}:${row.id}`)?.sourceHash !== hash(row.value))
      .map((row) => ({
        kind: row.kind,
        sourceId: row.id,
        reason: known.has(`${row.kind}:${row.id}`) ? "changed_since_snapshot" : "not_snapshotted",
      }));
    const sourceKeys = new Set(source.map((row) => `${row.kind}:${row.id}`));
    const removed = snapshots
      .filter((row) => !sourceKeys.has(`${row.entityKind}:${row.sourceId}`))
      .map((row) => ({
        kind: row.entityKind,
        sourceId: row.sourceId,
        reason: "removed_from_legacy",
      }));
    const [localEdits] = await Promise.all([
      runtime.database
        .select({ id: v2Books.id, version: v2Books.version, title: v2Books.legacyMetadata })
        .from(v2Books)
        .where(eq(v2Books.userId, userId)),
    ]);
    return {
      changed,
      removed,
      localEdits: localEdits
        .filter((row) => row.version > 0)
        .map((row) => ({ userBookId: row.id, version: row.version })),
      checkedAt: new Date().toISOString(),
    };
  });
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
        sort: browseSort.optional(),
        ...browseFields,
      })
      .strict(),
  )
  .handler(async ({ data: { sessionId, ...input } }) => {
    const { library, actor } = await context(sessionId);
    return library.libraryPage(actor, input);
  });
export const rowanBook = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, userBookId: key }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    const page = await library.libraryPage(actor, { userBookId: data.userBookId });
    return page.items[0] ?? null;
  });

export const rowanSearch = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        sessionId: key,
        query: z.string().trim().min(1).max(200),
        source: z.enum(["openlibrary", "googlebooks"]).default("googlebooks"),
        includeExtras: z.boolean().default(false),
      })
      .strict(),
  )
  .handler(async ({ data }) => {
    const { provider } = await context(data.sessionId, false);
    return qualitySearch(
      await provider.search(data.query, data.source),
      data.query,
      data.includeExtras,
    );
  });
export const rowanInsights = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, year: z.number().int().min(1900).max(9998).nullable(), timeZone: browseFields.timeZone }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    return library.insights(actor, data.year, data.timeZone);
  });
export const rowanLibraryFacets = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, timeZone: browseFields.timeZone }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    return library.browseFacets(actor, data.timeZone);
  });
export const rowanGoals = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, timeZone: browseFields.timeZone }).strict())
  .handler(async ({ data }) => {
    const { library, actor } = await context(data.sessionId);
    return library.goals(actor, data.timeZone);
  });
export const rowanSaveGoal = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        sessionId: key,
        key,
        id: z.string().min(1).max(200).optional(),
        metric: goalMetricSchema,
        title: z.string().trim().max(100).optional(),
        unit: z.string().trim().max(30).optional(),
        target: z.number().int().positive().max(10000000),
        timeframe: goalTimeframeSchema,
      })
      .strict(),
  )
  .handler(async ({ data: { sessionId, ...input } }) => {
    const { library, actor } = await context(sessionId);
    return library.saveGoal(actor, input);
  });
export const rowanLogGoal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, key, goalId: z.string().min(1).max(200), ...goalLogSchema.omit({ id: true }).shape }).strict())
  .handler(async ({ data: { sessionId, ...input } }) => {
    const { library, actor } = await context(sessionId);
    return library.logGoal(actor, input);
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
        userBookId: key.optional(),
        kind: z.enum(["note", "quote"]).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
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
    const { database, shelfService, actor } = await context(data.sessionId);
    const shelves = await shelfService.list(actor);
    return Promise.all(
      shelves.map(async (shelf) => {
        const items = await database
          .select({ userBookId: v2ShelfItems.userBookId })
          .from(v2ShelfItems)
          .where(eq(v2ShelfItems.shelfId, shelf.id))
          .orderBy(v2ShelfItems.sortOrder, v2ShelfItems.addedAt, v2ShelfItems.id);
        return {
          id: shelf.id,
          name: shelf.name,
          description: shelf.description,
          bookIds: items.map((item) => item.userBookId),
          version: shelf.version,
          itemCount: items.length,
        };
      }),
    );
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
      metadata: history.metadata,
      edition: history.edition,
      margins: history.margins.map((margin) => ({
        ...margin,
        createdAt: margin.createdAt.toISOString(),
        updatedAt: margin.updatedAt.toISOString(),
      })),
      isFavorite: history.isFavorite,
      halfStars: history.halfStars,
      tags: history.tags,
      sessions: history.sessions.map((s) => ({
        timerStartedAt: s.timerStartedAt?.toISOString() ?? null,
        readingSeconds: s.readingSeconds,
        timedReads: s.timedReads,
        id: s.id,
        state: s.state,
        unit: s.unit,
        total: s.total,
        position: s.position,
        loggedProgress: s.loggedProgress,
        version: s.version,
        startedAt: s.startedAt?.toISOString() ?? null,
        finishedAt: s.finishedAt?.toISOString() ?? null,
      })),
      entries: history.entries.map((e) => ({
        id: e.id,
        sessionId: e.readingSessionId,
        kind: e.kind,
        supersedesId: e.supersedesId,
        voided: e.voided,
        correctionReason: e.correctionReason,
        createdAt: e.createdAt.toISOString(),
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
        case "syncCatalog": {
          const { type, ...value } = data.command;
          await library.syncCatalog(actor, value);
          break;
        }
        case "history": {
          await library.changeHistory(actor, data.command.payload);
          break;
        }
        case "backlogImport": {
          await library.importBacklog(actor, data.command.payload);
          break;
        }
        case "timer": {
          const { type, ...value } = data.command;
          await library.timer(actor, value);
          break;
        }
        case "correctProgress": {
          const { type, ...value } = data.command;
          await library.correctProgress(actor, value);
          break;
        }
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
        case "shelfManage": {
          const { type, ...value } = data.command;
          await shelfService.manage(actor, value);
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

export const rowanOrganization = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key }).strict())
  .handler(async ({ data }) => {
    const { actor, database } = await context(data.sessionId);
    return createOrganizationService(database).read(actor);
  });
export const rowanOrganizationMutate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: key, command: organizationCommand }).strict())
  .handler(async ({ data }) => {
    const { actor, database } = await context(data.sessionId);
    try {
      await createOrganizationService(database).change(actor, data.command);
      return { ok: true as const };
    } catch (error) {
      if (error instanceof DomainError) return { ok: false as const, message: error.message };
      throw error;
    }
  });
