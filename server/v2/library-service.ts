import { createHash } from "node:crypto";
import { and, eq, sql, ilike, or, desc } from "drizzle-orm";
import { z } from "zod";
import type { db } from "../db.ts";
import { goals, userSettings } from "../../shared/schema.ts";
import {
  works,
  editions,
  externalMappings,
  userBooks,
  readingSessions,
  progressEntries,
  mutationReceipts,
  ratings,
  shelves,
  shelfItems,
  margins,
} from "../../shared/schema-v2.ts";

export type Actor = { userId: number };
type ErrorCode =
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "INVALID_TRANSITION"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_UNAVAILABLE";
export class DomainError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DomainError";
  }
}
const id = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const version = z.number().int().nonnegative();
const providerRefSchema = z
  .object({ provider: z.string().min(1), externalId: z.string().min(1) })
  .strict();
const catalogRecordSchema = z
  .object({
    title: z.string().trim().min(1),
    authors: z.array(z.string().min(1)),
    coverUrl: z.string().url().nullable(),
    edition: z
      .object({
        externalId: z.string().min(1),
        format: z.enum(["book", "audiobook", "ebook", "unknown"]),
        pageCount: z.number().int().positive().nullable(),
        durationSeconds: z.number().int().positive().nullable(),
        language: z.string().nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export interface CatalogProvider {
  // The implementation fetches this work from the provider. Never trust client metadata here.
  fetchWork(ref: z.infer<typeof providerRefSchema>): Promise<z.infer<typeof catalogRecordSchema>>;
}
const saveSchema = z.object({ key: id, ref: providerRefSchema }).strict();
const startSchema = z
  .object({
    key: id,
    userBookId: id,
    expectedVersion: version,
    startedAt: instant.nullable(),
    unit: z.enum(["page", "second", "percent"]),
    position: z.number().int().nonnegative().default(0),
  })
  .strict();
const progressSchema = z
  .object({
    key: id,
    sessionId: id,
    expectedVersion: version,
    position: z.number().int().nonnegative(),
    occurredAt: instant,
  })
  .strict();
const transitionSchema = z
  .object({
    key: id,
    sessionId: id,
    expectedVersion: version,
    action: z.enum(["pause", "resume", "finish", "dnf"]),
    occurredAt: instant.nullable(),
  })
  .strict();
type MutationResult = {
  workId: string;
  userBookId: string;
  sessionId: string | null;
  version: number;
};
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function expectVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new DomainError("VERSION_CONFLICT", "The record changed. Refresh before saving again.");
}
function fingerprint(operation: string, data: object) {
  return createHash("sha256").update(JSON.stringify({ operation, data })).digest("hex");
}

/** All private access takes a server-derived actor. */
export function createLibraryService(database: Database, provider: CatalogProvider) {
  async function mutate(
    actor: Actor,
    key: string,
    hash: string,
    action: (tx: Transaction) => Promise<MutationResult>,
  ): Promise<MutationResult> {
    z.number().int().positive().parse(actor.userId);
    return database.transaction(async (tx) => {
      // Serialize per actor so receipt checks, versions, and reading lifecycle stay atomic.
      await tx.execute(sql`select pg_advisory_xact_lock(21071, ${actor.userId})`);
      const [receipt] = await tx
        .select()
        .from(mutationReceipts)
        .where(and(eq(mutationReceipts.userId, actor.userId), eq(mutationReceipts.key, key)));
      if (receipt) {
        if (receipt.fingerprint !== hash)
          throw new DomainError(
            "IDEMPOTENCY_CONFLICT",
            "This request key was already used for different data.",
          );
        return z
          .object({ workId: id, userBookId: id, sessionId: id.nullable(), version })
          .parse(receipt.result);
      }
      const result = await action(tx);
      await tx
        .insert(mutationReceipts)
        .values({ userId: actor.userId, key, fingerprint: hash, result });
      return result;
    });
  }

  async function ownedBook(tx: Transaction, actor: Actor, bookId: string) {
    const [book] = await tx
      .select()
      .from(userBooks)
      .where(and(eq(userBooks.id, bookId), eq(userBooks.userId, actor.userId)))
      .for("update");
    if (!book) throw new DomainError("NOT_FOUND", "Book not found.");
    return book;
  }
  async function ownedSession(tx: Transaction, actor: Actor, sessionId: string) {
    const [result] = await tx
      .select({ session: readingSessions, book: userBooks })
      .from(readingSessions)
      .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
      .where(and(eq(readingSessions.id, sessionId), eq(userBooks.userId, actor.userId)))
      .for("update");
    if (!result) throw new DomainError("NOT_FOUND", "Reading attempt not found.");
    return result;
  }

  return {
    async archive(actor: Actor) {
      z.number().int().positive().parse(actor.userId);
      return database.transaction(
        async (tx) => {
          const owned = sql`select ${userBooks.id} from ${userBooks} where ${userBooks.userId} = ${actor.userId}`;
          const ownedWorks = sql`select ${userBooks.workId} from ${userBooks} where ${userBooks.userId} = ${actor.userId}`;
          const attempts = sql`select ${readingSessions.id} from ${readingSessions} where ${readingSessions.userBookId} in (${owned})`;
          return JSON.stringify(
            {
              format: "rowan-archive",
              version: 2,
              exportedAt: new Date().toISOString(),
              userBooks: await tx
                .select()
                .from(userBooks)
                .where(eq(userBooks.userId, actor.userId)),
              works: await tx
                .select()
                .from(works)
                .where(sql`${works.id} in (${ownedWorks})`),
              editions: await tx
                .select()
                .from(editions)
                .where(sql`${editions.workId} in (${ownedWorks})`),
              externalMappings: await tx
                .select()
                .from(externalMappings)
                .where(sql`${externalMappings.workId} in (${ownedWorks})`),
              readingSessions: await tx
                .select()
                .from(readingSessions)
                .where(sql`${readingSessions.userBookId} in (${owned})`),
              progressEntries: await tx
                .select()
                .from(progressEntries)
                .where(sql`${progressEntries.readingSessionId} in (${attempts})`),
              ratings: await tx
                .select()
                .from(ratings)
                .where(sql`${ratings.userBookId} in (${owned})`),
              margins: await tx
                .select()
                .from(margins)
                .where(sql`${margins.userBookId} in (${owned})`),
              shelves: await tx.select().from(shelves).where(eq(shelves.userId, actor.userId)),
              shelfItems: await tx
                .select()
                .from(shelfItems)
                .where(eq(shelfItems.userId, actor.userId)),
              goals: await tx.select().from(goals).where(eq(goals.userId, actor.userId)),
              settings: await tx
                .select()
                .from(userSettings)
                .where(eq(userSettings.userId, actor.userId)),
            },
            null,
            2,
          );
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    async marginJournal(actor: Actor, input: { query: string; offset: number }) {
      z.number().int().positive().parse(actor.userId);
      const data = z
        .object({ query: z.string().trim().max(200), offset: z.number().int().min(0).max(100000) })
        .strict()
        .parse(input);
      const term = `%${data.query.replace(/[\\%_]/g, "\\$&")}%`;
      const rows = await database
        .select({
          id: margins.id,
          body: margins.body,
          locator: margins.locator,
          updatedAt: margins.updatedAt,
          book: {
            id: userBooks.id,
            version: userBooks.version,
            status: userBooks.status,
            title: works.title,
            authors: works.authors,
            coverUrl: works.coverUrl,
            isFavorite: userBooks.isFavorite,
            halfStars: ratings.halfStars,
          },
        })
        .from(margins)
        .innerJoin(userBooks, eq(userBooks.id, margins.userBookId))
        .innerJoin(works, eq(works.id, userBooks.workId))
        .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
        .where(
          and(
            eq(userBooks.userId, actor.userId),
            sql`${margins.deletedAt} is null`,
            data.query ? or(ilike(margins.body, term), ilike(works.title, term)) : undefined,
          ),
        )
        .orderBy(desc(margins.updatedAt), margins.id)
        .limit(25)
        .offset(data.offset);
      return {
        items: rows.slice(0, 24).map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
        nextOffset: rows.length > 24 ? data.offset + 24 : null,
      };
    },
    async setAnnualGoal(actor: Actor, input: { key: string; year: number; target: number }) {
      const data = z
        .object({
          key: id,
          year: z.number().int().min(1900).max(9998),
          target: z.number().int().min(1).max(10000),
        })
        .strict()
        .parse(input);
      z.number().int().positive().parse(actor.userId);
      return database.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(21071, ${actor.userId})`);
        const hash = fingerprint("annualGoal", data);
        const [receipt] = await tx
          .select()
          .from(mutationReceipts)
          .where(
            and(eq(mutationReceipts.userId, actor.userId), eq(mutationReceipts.key, data.key)),
          );
        if (receipt) {
          if (receipt.fingerprint !== hash)
            throw new DomainError(
              "IDEMPOTENCY_CONFLICT",
              "This request key was already used for different data.",
            );
          return;
        }
        const goalId = `rowan:${actor.userId}:${data.year}:books`;
        await tx
          .insert(goals)
          .values({
            id: goalId,
            userId: actor.userId,
            metric: "books",
            timeframe: String(data.year),
            target: data.target,
          })
          .onConflictDoUpdate({
            target: goals.id,
            set: { target: data.target },
            setWhere: eq(goals.userId, actor.userId),
          });
        await tx.insert(mutationReceipts).values({
          userId: actor.userId,
          key: data.key,
          fingerprint: hash,
          result: { target: data.target, year: data.year },
        });
      });
    },
    async saveWork(actor: Actor, input: z.input<typeof saveSchema>) {
      const data = saveSchema.parse(input);
      // Known catalog entries remain usable while the provider is unavailable.
      const match = and(
        eq(externalMappings.provider, data.ref.provider),
        eq(externalMappings.entityKind, data.ref.provider === "googlebooks" ? "volume" : "work"),
        eq(externalMappings.externalId, data.ref.externalId),
      );
      const [known] = await database.select().from(externalMappings).where(match);
      let fetched: z.infer<typeof catalogRecordSchema> | null = null;
      if (!known) {
        try {
          fetched = catalogRecordSchema.parse(await provider.fetchWork(data.ref));
        } catch {
          throw new DomainError("PROVIDER_UNAVAILABLE", "Catalog lookup failed. Try again.");
        }
      }
      return mutate(actor, data.key, fingerprint("save", data), async (tx) => {
        // Different users saving the same provider work converge on one canonical ID.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(data.ref)}, 0))`,
        );
        const [mapping] = await tx.select().from(externalMappings).where(match);
        let workId = mapping?.workId;
        let editionId: string | null = mapping?.editionId ?? null;
        if (!workId) {
          if (!fetched)
            throw new DomainError(
              "PROVIDER_UNAVAILABLE",
              "Catalog identity changed. Retry lookup.",
            );
          const [work] = await tx
            .insert(works)
            .values({ title: fetched.title, authors: fetched.authors, coverUrl: fetched.coverUrl })
            .returning();
          workId = work.id;
          if (data.ref.provider !== "googlebooks")
            await tx.insert(externalMappings).values({ ...data.ref, entityKind: "work", workId });
          if (data.ref.provider === "googlebooks" && !fetched.edition)
            throw new DomainError(
              "PROVIDER_UNAVAILABLE",
              "Google Books volume details are missing.",
            );
          if (fetched.edition) {
            const { externalId, ...details } = fetched.edition;
            const [edition] = await tx
              .insert(editions)
              .values({ ...details, workId })
              .returning();
            editionId = edition.id;
            await tx.insert(externalMappings).values({
              provider: data.ref.provider,
              entityKind: data.ref.provider === "googlebooks" ? "volume" : "edition",
              externalId,
              workId,
              editionId,
            });
          }
        } else if (!editionId) {
          const [edition] = await tx
            .select()
            .from(editions)
            .where(eq(editions.workId, workId))
            .orderBy(editions.id)
            .limit(1);
          editionId = edition?.id ?? null;
        }
        const [existing] = await tx
          .select()
          .from(userBooks)
          .where(and(eq(userBooks.userId, actor.userId), eq(userBooks.workId, workId)));
        const book =
          existing ??
          (
            await tx
              .insert(userBooks)
              .values({ userId: actor.userId, workId, selectedEditionId: editionId })
              .returning()
          )[0];
        return { workId, userBookId: book.id, sessionId: null, version: book.version };
      });
    },

    async setEdition(
      actor: Actor,
      input: {
        key: string;
        userBookId: string;
        expectedVersion: number;
        format: "book" | "ebook" | "audiobook";
        total: number | null;
      },
    ) {
      const data = z
        .object({
          key: id,
          userBookId: id,
          expectedVersion: version,
          format: z.enum(["book", "ebook", "audiobook"]),
          total: z.number().int().positive().max(10000000).nullable(),
        })
        .strict()
        .parse(input);
      return mutate(actor, data.key, fingerprint("edition", data), async (tx) => {
        const book = await ownedBook(tx, actor, data.userBookId);
        expectVersion(book.version, data.expectedVersion);
        const [edition] = await tx
          .insert(editions)
          .values({
            workId: book.workId,
            format: data.format,
            pageCount: data.format === "audiobook" ? null : data.total,
            durationSeconds: data.format === "audiobook" ? data.total : null,
          })
          .returning();
        await tx
          .update(userBooks)
          .set({ selectedEditionId: edition.id, version: book.version + 1 })
          .where(eq(userBooks.id, book.id));
        return {
          workId: book.workId,
          userBookId: book.id,
          sessionId: null,
          version: book.version + 1,
        };
      });
    },

    async saveManual(
      actor: Actor,
      input: {
        key: string;
        title: string;
        author: string;
        format: "book" | "ebook" | "audiobook";
        total: number | null;
      },
    ) {
      const data = z
        .object({
          key: id,
          title: z.string().trim().min(1).max(500),
          author: z.string().trim().max(300),
          format: z.enum(["book", "ebook", "audiobook"]),
          total: z.number().int().positive().max(10000000).nullable(),
        })
        .strict()
        .parse(input);
      return mutate(actor, data.key, fingerprint("manual", data), async (tx) => {
        const [work] = await tx
          .insert(works)
          .values({ title: data.title, authors: data.author ? [data.author] : [] })
          .returning();
        const [edition] = await tx
          .insert(editions)
          .values({
            workId: work.id,
            format: data.format,
            pageCount: data.format === "audiobook" ? null : data.total,
            durationSeconds: data.format === "audiobook" ? data.total : null,
          })
          .returning();
        const [book] = await tx
          .insert(userBooks)
          .values({ userId: actor.userId, workId: work.id, selectedEditionId: edition.id })
          .returning();
        return { workId: work.id, userBookId: book.id, sessionId: null, version: book.version };
      });
    },

    async insights(actor: Actor, year: number) {
      z.number().int().positive().parse(actor.userId);
      z.number().int().min(1900).max(9998).parse(year);
      const from = new Date(Date.UTC(year, 0, 1));
      const to = new Date(Date.UTC(year + 1, 0, 1));
      const books = await database
        .select({
          status: userBooks.status,
          halfStars: ratings.halfStars,
          favorite: userBooks.isFavorite,
        })
        .from(userBooks)
        .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
        .where(eq(userBooks.userId, actor.userId));
      const finished = await database
        .select({ workId: readingSessions.workId, finishedAt: readingSessions.finishedAt })
        .from(readingSessions)
        .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
        .where(
          and(
            eq(userBooks.userId, actor.userId),
            eq(readingSessions.state, "completed"),
            sql`${readingSessions.finishedAt} >= ${from} and ${readingSessions.finishedAt} < ${to}`,
          ),
        );
      const months = Array.from({ length: 12 }, () => 0);
      for (const read of finished) if (read.finishedAt) months[read.finishedAt.getUTCMonth()]++;
      const rated = books.filter((book) => book.halfStars !== null);
      const [goal] = await database
        .select({ target: goals.target })
        .from(goals)
        .where(
          and(eq(goals.userId, actor.userId), eq(goals.id, `rowan:${actor.userId}:${year}:books`)),
        );
      return {
        year,
        goal: goal?.target ?? null,
        libraryCount: books.length,
        finishedReads: finished.length,
        uniqueWorks: new Set(finished.map((read) => read.workId)).size,
        months,
        favorites: books.filter((book) => book.favorite).length,
        ratedBooks: rated.length,
        averageRating: rated.length
          ? rated.reduce((sum, book) => sum + book.halfStars!, 0) / rated.length / 2
          : null,
        statuses: Object.fromEntries(
          ["want_to_read", "reading", "paused", "read", "dnf"].map((status) => [
            status,
            books.filter((book) => book.status === status).length,
          ]),
        ),
      };
    },

    async listLibrary(actor: Actor) {
      z.number().int().positive().parse(actor.userId);
      return database
        .select({ userBook: userBooks, work: works })
        .from(userBooks)
        .innerJoin(works, eq(works.id, userBooks.workId))
        .where(eq(userBooks.userId, actor.userId))
        .orderBy(userBooks.addedAt, userBooks.id);
    },

    async calendar(actor: Actor, input: { from: string; to: string }) {
      z.number().int().positive().parse(actor.userId);
      const data = z
        .object({ from: instant, to: instant })
        .strict()
        .refine((d) => {
          const span = Date.parse(d.to) - Date.parse(d.from);
          return span > 0 && span <= 32 * 86400000;
        }, "Choose a range of at most 32 days.")
        .parse(input);
      const from = new Date(data.from),
        to = new Date(data.to);
      const book = {
        id: userBooks.id,
        version: userBooks.version,
        status: userBooks.status,
        title: works.title,
        authors: works.authors,
        coverUrl: works.coverUrl,
        isFavorite: userBooks.isFavorite,
        halfStars: ratings.halfStars,
      };
      const inRange = (
        column:
          | typeof progressEntries.occurredAt
          | typeof readingSessions.startedAt
          | typeof readingSessions.finishedAt,
      ) =>
        and(sql`${column} >= ${from}`, sql`${column} < ${to}`, eq(userBooks.userId, actor.userId));
      const [observations, starts, finishes] = await Promise.all([
        database
          .select({
            id: progressEntries.id,
            at: progressEntries.occurredAt,
            position: progressEntries.position,
            unit: readingSessions.unit,
            book,
          })
          .from(progressEntries)
          .innerJoin(readingSessions, eq(readingSessions.id, progressEntries.readingSessionId))
          .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
          .innerJoin(works, eq(works.id, userBooks.workId))
          .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
          .where(and(inRange(progressEntries.occurredAt), eq(progressEntries.kind, "observation")))
          .orderBy(progressEntries.occurredAt, progressEntries.id)
          .limit(1001),
        database
          .select({ id: readingSessions.id, at: readingSessions.startedAt, book })
          .from(readingSessions)
          .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
          .innerJoin(works, eq(works.id, userBooks.workId))
          .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
          .where(inRange(readingSessions.startedAt))
          .orderBy(readingSessions.startedAt, readingSessions.id)
          .limit(1001),
        database
          .select({
            id: readingSessions.id,
            at: readingSessions.finishedAt,
            state: readingSessions.state,
            book,
          })
          .from(readingSessions)
          .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
          .innerJoin(works, eq(works.id, userBooks.workId))
          .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
          .where(
            and(
              inRange(readingSessions.finishedAt),
              sql`${readingSessions.state} in ('completed', 'dnf')`,
            ),
          )
          .orderBy(readingSessions.finishedAt, readingSessions.id)
          .limit(1001),
      ]);
      const events = [
        ...observations.slice(0, 1000).map((e) => ({
          id: `progress:${e.id}`,
          at: e.at!.toISOString(),
          kind: "progress" as const,
          position: e.position,
          unit: e.unit,
          book: e.book,
        })),
        ...starts.slice(0, 1000).map((e) => ({
          id: `start:${e.id}`,
          at: e.at!.toISOString(),
          kind: "start" as const,
          position: null,
          unit: null,
          book: e.book,
        })),
        ...finishes.slice(0, 1000).map((e) => ({
          id: `finish:${e.id}`,
          at: e.at!.toISOString(),
          kind: e.state === "completed" ? ("finish" as const) : ("dnf" as const),
          position: null,
          unit: null,
          book: e.book,
        })),
      ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
      return {
        events,
        truncated: [observations, starts, finishes].some((rows) => rows.length > 1000),
      };
    },

    async home(actor: Actor) {
      z.number().int().positive().parse(actor.userId);
      const book = {
        id: userBooks.id,
        version: userBooks.version,
        status: userBooks.status,
        title: works.title,
        authors: works.authors,
        coverUrl: works.coverUrl,
        isFavorite: userBooks.isFavorite,
        halfStars: ratings.halfStars,
      };
      // Select from the whole account, independent of Library pagination and filters.
      const [last, current, next] = await Promise.all([
        database
          .select({ book, finishedAt: readingSessions.finishedAt })
          .from(readingSessions)
          .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
          .innerJoin(works, eq(works.id, userBooks.workId))
          .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
          .where(and(eq(userBooks.userId, actor.userId), eq(readingSessions.state, "completed")))
          .orderBy(sql`${readingSessions.finishedAt} desc nulls last`, readingSessions.id)
          .limit(1),
        database
          .select({
            book,
            state: readingSessions.state,
            position: readingSessions.position,
            total: readingSessions.total,
            unit: readingSessions.unit,
          })
          .from(readingSessions)
          .innerJoin(userBooks, eq(userBooks.id, readingSessions.userBookId))
          .innerJoin(works, eq(works.id, userBooks.workId))
          .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
          .where(
            and(
              eq(userBooks.userId, actor.userId),
              sql`${readingSessions.state} in ('active', 'paused')`,
            ),
          )
          .orderBy(
            sql`case when ${readingSessions.state} = 'active' then 0 else 1 end`,
            sql`${readingSessions.startedAt} desc nulls last`,
            readingSessions.id,
          )
          .limit(7),
        database
          .select(book)
          .from(userBooks)
          .innerJoin(works, eq(works.id, userBooks.workId))
          .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
          .where(and(eq(userBooks.userId, actor.userId), eq(userBooks.status, "want_to_read")))
          .orderBy(sql`${userBooks.addedAt} desc`, userBooks.id)
          .limit(3),
      ]);
      return {
        last: last[0]
          ? { book: last[0].book, finishedAt: last[0].finishedAt?.toISOString() ?? null }
          : null,
        current: current.slice(0, 6),
        hasMoreCurrent: current.length > 6,
        next,
      };
    },

    async libraryPage(
      actor: Actor,
      input: {
        offset?: number;
        query?: string;
        status?: string;
        favoritesOnly?: boolean;
        shelfId?: string;
        sort?: "newest" | "oldest" | "title" | "rating";
      },
    ) {
      z.number().int().positive().parse(actor.userId);
      const data = z
        .object({
          offset: z.number().int().min(0).max(100000).default(0),
          query: z.string().trim().max(200).default(""),
          favoritesOnly: z.boolean().default(false),
          shelfId: id.optional(),
          sort: z.enum(["newest", "oldest", "title", "rating"]).default("newest"),
          status: z
            .enum(["all", "want_to_read", "reading", "paused", "read", "dnf"])
            .default("all"),
        })
        .parse(input);
      const term = `%${data.query.replace(/[\\%_]/g, "\\$&")}%`;
      const rows = await database
        .select({
          id: userBooks.id,
          version: userBooks.version,
          status: userBooks.status,
          title: works.title,
          authors: works.authors,
          coverUrl: works.coverUrl,
          isFavorite: userBooks.isFavorite,
          halfStars: ratings.halfStars,
        })
        .from(userBooks)
        .innerJoin(works, eq(works.id, userBooks.workId))
        .leftJoin(ratings, eq(ratings.userBookId, userBooks.id))
        .where(
          and(
            eq(userBooks.userId, actor.userId),
            data.favoritesOnly ? eq(userBooks.isFavorite, true) : undefined,
            data.shelfId
              ? sql`exists (select 1 from ${shelfItems} join ${shelves} on ${shelves.id} = ${shelfItems.shelfId} where ${shelfItems.userBookId} = ${userBooks.id} and ${shelves.id} = ${data.shelfId} and ${shelves.userId} = ${actor.userId})`
              : undefined,
            data.status === "all" ? undefined : eq(userBooks.status, data.status),
            data.query
              ? or(ilike(works.title, term), ilike(sql`${works.authors}::text`, term))
              : undefined,
          ),
        )
        .orderBy(
          data.sort === "title"
            ? works.title
            : data.sort === "rating"
              ? sql`${ratings.halfStars} desc nulls last`
              : data.sort === "oldest"
                ? userBooks.addedAt
                : desc(userBooks.addedAt),
          userBooks.id,
        )
        .limit(25)
        .offset(data.offset);
      return { items: rows.slice(0, 24), nextOffset: rows.length > 24 ? data.offset + 24 : null };
    },

    async changeMargin(
      actor: Actor,
      input: {
        key: string;
        userBookId: string;
        marginId: string;
        expectedVersion: number | null;
        action: "save" | "delete";
        body?: string;
        locator?: string | null;
      },
    ) {
      const data = z
        .object({
          key: id,
          userBookId: id,
          marginId: id,
          expectedVersion: version.nullable(),
          action: z.enum(["save", "delete"]),
          body: z.string().trim().min(1).max(10000).optional(),
          locator: z.string().trim().max(120).nullable().optional(),
        })
        .strict()
        .refine((d) => d.action !== "save" || d.body !== undefined, "A margin needs text.")
        .parse(input);
      return mutate(actor, data.key, fingerprint("margin", data), async (tx) => {
        const book = await ownedBook(tx, actor, data.userBookId);
        const [existing] = await tx.select().from(margins).where(eq(margins.id, data.marginId));
        if (existing && (existing.userBookId !== book.id || existing.deletedAt))
          throw new DomainError("NOT_FOUND", "Margin not found.");
        if (data.expectedVersion === null) {
          if (existing)
            throw new DomainError(
              "VERSION_CONFLICT",
              "This margin already exists. Refresh before editing.",
            );
          if (data.action !== "save") throw new DomainError("NOT_FOUND", "Margin not found.");
          await tx.insert(margins).values({
            id: data.marginId,
            userBookId: book.id,
            body: data.body!,
            locator: data.locator || null,
          });
        } else {
          if (!existing) throw new DomainError("NOT_FOUND", "Margin not found.");
          expectVersion(existing.version, data.expectedVersion);
          await tx
            .update(margins)
            .set(
              data.action === "delete"
                ? { deletedAt: new Date(), updatedAt: new Date(), version: existing.version + 1 }
                : {
                    body: data.body!,
                    locator: data.locator === undefined ? existing.locator : data.locator || null,
                    updatedAt: new Date(),
                    version: existing.version + 1,
                  },
            )
            .where(eq(margins.id, existing.id));
        }
        return { workId: book.workId, userBookId: book.id, sessionId: null, version: book.version };
      });
    },

    async personalize(
      actor: Actor,
      input: {
        key: string;
        userBookId: string;
        expectedVersion: number;
        isFavorite?: boolean;
        halfStars?: number | null;
      },
    ) {
      const data = z
        .object({
          key: id,
          userBookId: id,
          expectedVersion: version,
          isFavorite: z.boolean().optional(),
          halfStars: z.number().int().min(1).max(10).nullable().optional(),
        })
        .strict()
        .refine((d) => d.isFavorite !== undefined || d.halfStars !== undefined, "Choose a change.")
        .parse(input);
      return mutate(actor, data.key, fingerprint("personalize", data), async (tx) => {
        const book = await ownedBook(tx, actor, data.userBookId);
        expectVersion(book.version, data.expectedVersion);
        if (data.halfStars === null)
          await tx.delete(ratings).where(eq(ratings.userBookId, book.id));
        else if (data.halfStars !== undefined)
          await tx
            .insert(ratings)
            .values({ userBookId: book.id, halfStars: data.halfStars })
            .onConflictDoUpdate({ target: ratings.userBookId, set: { halfStars: data.halfStars } });
        await tx
          .update(userBooks)
          .set({ isFavorite: data.isFavorite ?? book.isFavorite, version: book.version + 1 })
          .where(eq(userBooks.id, book.id));
        return {
          workId: book.workId,
          userBookId: book.id,
          sessionId: null,
          version: book.version + 1,
        };
      });
    },

    async startReading(actor: Actor, input: z.input<typeof startSchema>) {
      const data = startSchema.parse(input);
      return mutate(actor, data.key, fingerprint("start", data), async (tx) => {
        const book = await ownedBook(tx, actor, data.userBookId);
        expectVersion(book.version, data.expectedVersion);
        const [open] = await tx
          .select()
          .from(readingSessions)
          .where(
            and(
              eq(readingSessions.userBookId, book.id),
              sql`${readingSessions.state} in ('active', 'paused')`,
            ),
          );
        if (open)
          throw new DomainError(
            "INVALID_TRANSITION",
            "This book already has an open reading attempt.",
          );
        const [edition] = book.selectedEditionId
          ? await tx.select().from(editions).where(eq(editions.id, book.selectedEditionId))
          : [];
        if (
          edition &&
          ((data.unit === "second" && !["audiobook", "unknown"].includes(edition.format)) ||
            (data.unit === "page" && edition.format === "audiobook"))
        ) {
          throw new DomainError(
            "INVALID_TRANSITION",
            "Progress unit does not match the selected edition.",
          );
        }
        const total =
          data.unit === "percent"
            ? 100
            : data.unit === "page"
              ? (edition?.pageCount ?? null)
              : (edition?.durationSeconds ?? null);
        if (total !== null && data.position > total)
          throw new DomainError("INVALID_TRANSITION", "Progress exceeds the edition length.");
        const [session] = await tx
          .insert(readingSessions)
          .values({
            userBookId: book.id,
            workId: book.workId,
            editionId: book.selectedEditionId,
            startedAt: data.startedAt ? new Date(data.startedAt) : null,
            unit: data.unit,
            total,
            position: data.position,
          })
          .returning();
        await tx.insert(progressEntries).values({
          readingSessionId: session.id,
          kind: "baseline",
          position: data.position,
          occurredAt: data.startedAt ? new Date(data.startedAt) : null,
        });
        await tx
          .update(userBooks)
          .set({ status: "reading", version: book.version + 1 })
          .where(eq(userBooks.id, book.id));
        return {
          workId: book.workId,
          userBookId: book.id,
          sessionId: session.id,
          version: session.version,
        };
      });
    },

    async recordProgress(actor: Actor, input: z.input<typeof progressSchema>) {
      const data = progressSchema.parse(input);
      return mutate(actor, data.key, fingerprint("progress", data), async (tx) => {
        const { session, book } = await ownedSession(tx, actor, data.sessionId);
        expectVersion(session.version, data.expectedVersion);
        if (session.state !== "active")
          throw new DomainError("INVALID_TRANSITION", "Resume reading before logging progress.");
        const [latest] = await tx
          .select()
          .from(progressEntries)
          .where(eq(progressEntries.readingSessionId, session.id))
          .orderBy(sql`${progressEntries.occurredAt} desc nulls last`)
          .limit(1);
        if (latest?.occurredAt && new Date(data.occurredAt) < latest.occurredAt)
          throw new DomainError(
            "INVALID_TRANSITION",
            "Backdated corrections require the later history editor.",
          );
        if (
          data.position < session.position ||
          (session.total !== null && data.position > session.total)
        )
          throw new DomainError(
            "INVALID_TRANSITION",
            "Use a correction for backward progress; progress cannot exceed the edition length.",
          );
        await tx.insert(progressEntries).values({
          readingSessionId: session.id,
          kind: "observation",
          position: data.position,
          occurredAt: new Date(data.occurredAt),
        });
        await tx
          .update(readingSessions)
          .set({ position: data.position, version: session.version + 1 })
          .where(eq(readingSessions.id, session.id));
        return {
          workId: book.workId,
          userBookId: book.id,
          sessionId: session.id,
          version: session.version + 1,
        };
      });
    },

    async transitionReading(actor: Actor, input: z.input<typeof transitionSchema>) {
      const data = transitionSchema.parse(input);
      return mutate(actor, data.key, fingerprint("transition", data), async (tx) => {
        const { session, book } = await ownedSession(tx, actor, data.sessionId);
        expectVersion(session.version, data.expectedVersion);
        const allowed =
          data.action === "resume"
            ? session.state === "paused"
            : data.action === "pause"
              ? session.state === "active"
              : ["active", "paused"].includes(session.state);
        if (!allowed)
          throw new DomainError("INVALID_TRANSITION", "That reading transition is not available.");
        const terminal = data.action === "finish" || data.action === "dnf";
        const finishedAt = terminal && data.occurredAt ? new Date(data.occurredAt) : null;
        const [latest] = await tx
          .select()
          .from(progressEntries)
          .where(eq(progressEntries.readingSessionId, session.id))
          .orderBy(sql`${progressEntries.occurredAt} desc nulls last`)
          .limit(1);
        if (
          finishedAt &&
          ((session.startedAt && finishedAt < session.startedAt) ||
            (latest?.occurredAt && finishedAt < latest.occurredAt))
        )
          throw new DomainError(
            "INVALID_TRANSITION",
            "Finish cannot precede recorded reading activity.",
          );
        const state =
          data.action === "finish"
            ? "completed"
            : data.action === "resume"
              ? "active"
              : data.action === "pause"
                ? "paused"
                : "dnf";
        const status =
          data.action === "finish"
            ? "read"
            : data.action === "resume"
              ? "reading"
              : data.action === "pause"
                ? "paused"
                : "dnf";
        await tx
          .update(readingSessions)
          .set({ state, finishedAt, version: session.version + 1 })
          .where(eq(readingSessions.id, session.id));
        await tx
          .update(userBooks)
          .set({ status, version: book.version + 1 })
          .where(eq(userBooks.id, book.id));
        // Finishing does not fabricate an observed last-day page/audio delta.
        return {
          workId: book.workId,
          userBookId: book.id,
          sessionId: session.id,
          version: session.version + 1,
        };
      });
    },

    async readingHistory(actor: Actor, userBookId: string) {
      id.parse(userBookId);
      return database.transaction(async (tx) => {
        const book = await ownedBook(tx, actor, userBookId);
        const [edition] = book.selectedEditionId
          ? await tx
              .select()
              .from(editions)
              .where(and(eq(editions.id, book.selectedEditionId), eq(editions.workId, book.workId)))
          : [];
        const [rating] = await tx.select().from(ratings).where(eq(ratings.userBookId, book.id));
        const sessions = await tx
          .select()
          .from(readingSessions)
          .where(eq(readingSessions.userBookId, userBookId))
          .orderBy(readingSessions.id);
        const entries = await tx
          .select({ entry: progressEntries })
          .from(progressEntries)
          .innerJoin(readingSessions, eq(readingSessions.id, progressEntries.readingSessionId))
          .where(eq(readingSessions.userBookId, userBookId))
          .orderBy(progressEntries.createdAt, progressEntries.id);
        return {
          userBookVersion: book.version,
          edition: edition
            ? {
                format: edition.format,
                pageCount: edition.pageCount,
                durationSeconds: edition.durationSeconds,
              }
            : null,
          margins: await tx
            .select({
              id: margins.id,
              body: margins.body,
              locator: margins.locator,
              version: margins.version,
              createdAt: margins.createdAt,
              updatedAt: margins.updatedAt,
            })
            .from(margins)
            .where(and(eq(margins.userBookId, book.id), sql`${margins.deletedAt} is null`))
            .orderBy(margins.createdAt, margins.id),
          isFavorite: book.isFavorite,
          halfStars: rating?.halfStars ?? null,
          sessions,
          entries: entries.map(({ entry }) => entry),
        };
      });
    },
  };
}
