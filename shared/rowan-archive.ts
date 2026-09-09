import { z } from "zod";
import type { JsonValue } from "./json.ts";

const json: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(json), z.record(json)]),
);
export const metadataSchema = z.record(json).superRefine((value, ctx) => {
  if (
    value.rowanDetails !== undefined &&
    !z
      .object({
        title: z.string().min(1),
        authors: z.array(z.string()),
        coverUrl: z.string().nullable(),
      })
      .strict()
      .safeParse(value.rowanDetails).success
  )
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid personal book details." });
});
const id = z.string().uuid();
const date = z.string().datetime({ offset: true });
const integer = z.number().int().nonnegative().max(2147483647);
const owner = z.number().int().positive();
export const goalTimeframeSchema = z.union([
  z.enum(["week", "month", "year"]),
  z
    .string()
    .regex(/^\d{4}$/)
    .refine((v) => Number(v) >= 1900 && Number(v) <= 9998),
]);
const rows = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).max(100000);
export const settingsSchema = z
  .object({
    darkMode: z.boolean(),
    accentColor: z.string().min(1).max(40),
    compactMode: z.boolean(),
    fontScale: z.enum(["sm", "md", "lg"]),
  })
  .strict();
export const bookEditSchema = z
  .object({
    userBookId: id,
    expectedVersion: integer,
    title: z.string().trim().min(1).max(500),
    authors: z.array(z.string().trim().min(1).max(300)).max(100),
    coverUrl: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS cover URL.")
      .nullable(),
    metadata: metadataSchema,
  })
  .strict();
const archiveSchema = z
  .object({
    format: z.literal("rowan-archive"),
    version: z.union([z.literal(2), z.literal(3)]),
    exportedAt: date,
    works: rows(
      z
        .object({
          id,
          title: z
            .string()
            .min(1)
            .refine((v) => v.trim().length > 0),
          authors: z.array(z.string()),
          coverUrl: z.string().nullable(),
          createdAt: date,
        })
        .strict(),
    ),
    editions: rows(
      z
        .object({
          id,
          workId: id,
          format: z.enum(["book", "ebook", "audiobook", "unknown"]),
          pageCount: integer.positive().nullable(),
          durationSeconds: integer.positive().nullable(),
          language: z.string().nullable(),
        })
        .strict(),
    ),
    externalMappings: rows(
      z
        .object({
          id,
          provider: z.string(),
          entityKind: z.enum(["work", "edition", "volume"]),
          externalId: z.string(),
          workId: id,
          editionId: id.nullable(),
        })
        .strict(),
    ),
    userBooks: rows(
      z
        .object({
          id,
          userId: owner,
          workId: id,
          selectedEditionId: id.nullable(),
          status: z.enum(["want_to_read", "reading", "paused", "read", "dnf"]),
          isFavorite: z.boolean(),
          addedAt: date,
          legacyMetadata: metadataSchema,
          version: integer,
        })
        .strict(),
    ),
    readingSessions: rows(
      z
        .object({
          id,
          userBookId: id,
          workId: id,
          editionId: id.nullable(),
          state: z.enum(["active", "paused", "completed", "dnf"]),
          startedAt: date.nullable(),
          finishedAt: date.nullable(),
          unit: z.enum(["page", "second", "percent"]),
          total: integer.positive().nullable(),
          position: integer,
          version: integer,
        })
        .strict(),
    ),
    progressEntries: rows(
      z
        .object({
          id,
          readingSessionId: id,
          kind: z.enum(["baseline", "observation"]),
          supersedesId: id.nullable().default(null),
          voided: z.boolean().default(false),
          correctionReason: z.string().trim().min(1).max(1000).nullable().default(null),
          position: integer,
          occurredAt: date.nullable(),
          createdAt: date,
        })
        .strict(),
    ),
    ratings: rows(
      z.object({ userBookId: id, halfStars: z.number().int().min(1).max(10) }).strict(),
    ),
    margins: rows(
      z
        .object({
          id,
          userBookId: id,
          body: z
            .string()
            .min(1)
            .max(10000)
            .refine((v) => v.trim().length > 0),
          kind: z.enum(["note", "quote"]).default("note"),
          locator: z.string().max(120).nullable(),
          version: integer,
          createdAt: date,
          updatedAt: date,
          deletedAt: date.nullable(),
        })
        .strict(),
    ),
    shelves: rows(
      z
        .object({
          id,
          userId: owner,
          name: z.string().trim().min(1).max(120),
          version: integer,
          createdAt: date,
        })
        .strict(),
    ),
    shelfItems: rows(
      z.object({ id, shelfId: id, userId: owner, userBookId: id, addedAt: date }).strict(),
    ),
    goals: rows(
      z
        .object({
          id: z.string().min(1),
          userId: owner,
          metric: z.enum(["books", "pages", "minutes"]),
          target: integer.positive(),
          timeframe: goalTimeframeSchema,
          createdAt: date,
        })
        .strict(),
    ),
    settings: z.array(settingsSchema.extend({ userId: owner })).max(1),
  })
  .strict();
export type RowanArchive = z.infer<typeof archiveSchema>;

/** Validate every relationship before any destination rows are removed. */
export function parseRowanArchive(raw: string): RowanArchive {
  if (raw.length > 20 * 1024 * 1024) throw new Error("Archive exceeds the 20 MB limit.");
  const data = archiveSchema.parse(JSON.parse(raw));
  const require = (condition: unknown, message: string) => {
    if (!condition) throw new Error(`Invalid archive: ${message}`);
  };
  function unique<T>(items: T[], key: (item: T) => string) {
    const keys = items.map(key);
    require(new Set(keys).size === keys.length, "duplicate record or membership.");
  }
  for (const list of [
    data.works,
    data.editions,
    data.externalMappings,
    data.userBooks,
    data.readingSessions,
    data.progressEntries,
    data.margins,
    data.shelves,
    data.shelfItems,
    data.goals,
  ])
    unique(list as { id: string }[], (r) => r.id);
  unique(data.userBooks, (r) => r.workId);
  unique(data.ratings, (r) => r.userBookId);
  unique(data.shelves, (r) => r.name);
  unique(data.shelfItems, (r) => `${r.shelfId}:${r.userBookId}`);
  unique(data.externalMappings, (r) => `${r.provider}:${r.entityKind}:${r.externalId}`);
  const owners = new Set(
    [...data.userBooks, ...data.shelves, ...data.shelfItems, ...data.goals, ...data.settings].map(
      (r) => r.userId,
    ),
  );
  require(owners.size <= 1, "multiple owners.");
  const works = new Set(data.works.map((r) => r.id));
  const editions = new Map(data.editions.map((r) => [r.id, r]));
  const books = new Map(data.userBooks.map((r) => [r.id, r]));
  const sessions = new Map(data.readingSessions.map((r) => [r.id, r]));
  const shelves = new Set(data.shelves.map((r) => r.id));
  const matches = (edition: string | null, work: string) =>
    !edition || editions.get(edition)?.workId === work;
  for (const e of data.editions) require(works.has(e.workId), "edition has no work.");
  for (const b of data.userBooks)
    require(works.has(b.workId) &&
      matches(b.selectedEditionId, b.workId), "book/edition mismatch.");
  for (const m of data.externalMappings)
    require(works.has(m.workId) &&
      matches(m.editionId, m.workId) &&
      (m.entityKind === "work" ? !m.editionId : !!m.editionId), "invalid catalog mapping.");
  unique(
    data.readingSessions.filter((s) => s.state === "active" || s.state === "paused"),
    (r) => r.userBookId,
  );
  for (const s of data.readingSessions) {
    require(books.get(s.userBookId)?.workId === s.workId &&
      matches(s.editionId, s.workId), "session/book mismatch.");
    require(s.total === null || s.position <= s.total, "progress exceeds total.");
    require(s.unit !== "percent" || s.total === 100, "invalid percent total.");
    require(!s.startedAt ||
      !s.finishedAt ||
      Date.parse(s.finishedAt) >= Date.parse(s.startedAt), "finish precedes start.");
    require(!["active", "paused"].includes(s.state) ||
      !s.finishedAt, "open session has finish date.");
  }
  const entries = new Map(data.progressEntries.map((entry) => [entry.id, entry]));
  const replaced = new Set<string>();
  for (const e of data.progressEntries) {
    require(sessions.has(e.readingSessionId) && (e.kind === "baseline" || e.occurredAt), "invalid progress entry.");
    if (e.supersedesId) {
      const original = entries.get(e.supersedesId);
      require(original && original.readingSessionId === e.readingSessionId && original.kind === "observation" && !original.voided && e.kind === "observation" && e.correctionReason, "invalid progress correction.");
      require(!replaced.has(e.supersedesId), "branched progress correction.");
      replaced.add(e.supersedesId);
    } else require(!e.voided && !e.correctionReason, "orphan progress correction.");
  }
  // Topological ordering validates cycles and makes FK-safe archive restore independent of row order.
  const ordered: typeof data.progressEntries = [];
  const visited = new Set<string>();
  for (const entry of data.progressEntries) {
    const path: typeof data.progressEntries = [];
    const walking = new Set<string>();
    let node: typeof entry | undefined = entry;
    while (node && !visited.has(node.id)) {
      require(!walking.has(node.id), "cyclic progress correction.");
      walking.add(node.id); path.push(node);
      node = node.supersedesId ? entries.get(node.supersedesId) : undefined;
    }
    for (const node of path.reverse()) { visited.add(node.id); ordered.push(node); }
  }
  data.progressEntries = ordered;
  for (const r of [...data.ratings, ...data.margins])
    require(books.has(r.userBookId), "orphan personal record.");
  for (const r of data.shelfItems)
    require(books.has(r.userBookId) && shelves.has(r.shelfId), "orphan shelf membership.");
  return data;
}
