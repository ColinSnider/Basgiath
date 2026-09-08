import { relations, sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  foreignKey,
  check,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema.ts";
import type { JsonValue } from "./json.ts";

// Isolated from the legacy schema and its production migration entry point.
export const v2 = pgSchema("v2");
// Only sync decisions live here; deleting personal data never deletes the source.
export const accountState = v2.table("account_state", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "restrict" }),
  mirrorPaused: boolean("mirror_paused").notNull().default(false),
  settingsEdited: boolean("settings_edited").notNull().default(false),
  excludedWorkIds: jsonb("excluded_work_ids").$type<string[]>().notNull().default([]),
  excludedGoalIds: jsonb("excluded_goal_ids").$type<string[]>().notNull().default([]),
});
export const works = v2.table(
  "works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    authors: jsonb("authors").$type<string[]>().notNull().default([]),
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("work_title_not_blank", sql`length(trim(${t.title})) > 0`)],
);

export const editions = v2.table(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "restrict" }),
    format: text("format").$type<"book" | "audiobook" | "ebook" | "unknown">().notNull(),
    pageCount: integer("page_count"),
    durationSeconds: integer("duration_seconds"),
    language: text("language"),
  },
  (t) => [
    uniqueIndex("edition_work_pair").on(t.id, t.workId),
    check("edition_format", sql`${t.format} in ('book', 'audiobook', 'ebook', 'unknown')`),
    check("edition_positive_pages", sql`${t.pageCount} is null or ${t.pageCount} > 0`),
    check(
      "edition_positive_duration",
      sql`${t.durationSeconds} is null or ${t.durationSeconds} > 0`,
    ),
  ],
);

export const externalMappings = v2.table(
  "external_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    entityKind: text("entity_kind").$type<"work" | "edition" | "volume">().notNull(),
    externalId: text("external_id").notNull(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id"),
  },
  (t) => [
    uniqueIndex("provider_identity").on(t.provider, t.entityKind, t.externalId),
    foreignKey({
      columns: [t.editionId, t.workId],
      foreignColumns: [editions.id, editions.workId],
    }),
    check(
      "mapping_target_kind",
      sql`(${t.entityKind} = 'work' and ${t.editionId} is null) or (${t.entityKind} in ('edition', 'volume') and ${t.editionId} is not null)`,
    ),
  ],
);

export const userBooks = v2.table(
  "user_books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "restrict" }),
    selectedEditionId: uuid("selected_edition_id"),
    status: text("status")
      .$type<"want_to_read" | "reading" | "paused" | "read" | "dnf">()
      .notNull()
      .default("want_to_read"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    legacyMetadata: jsonb("legacy_metadata")
      .$type<Record<string, JsonValue>>()
      .notNull()
      .default({}),
    version: integer("version").notNull().default(0),
  },
  (t) => [
    uniqueIndex("user_work_membership").on(t.userId, t.workId),
    uniqueIndex("user_book_work_pair").on(t.id, t.workId),
    uniqueIndex("user_book_owner_pair").on(t.id, t.userId),
    foreignKey({
      columns: [t.selectedEditionId, t.workId],
      foreignColumns: [editions.id, editions.workId],
    }),
    check(
      "user_book_status",
      sql`${t.status} in ('want_to_read', 'reading', 'paused', 'read', 'dnf')`,
    ),
  ],
);

export const readingSessions = v2.table(
  "reading_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userBookId: uuid("user_book_id").notNull(),
    workId: uuid("work_id").notNull(),
    editionId: uuid("edition_id"),
    state: text("state")
      .$type<"active" | "paused" | "completed" | "dnf">()
      .notNull()
      .default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    unit: text("unit").$type<"page" | "second" | "percent">().notNull(),
    total: integer("total"),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(0),
  },
  (t) => [
    foreignKey({
      columns: [t.userBookId, t.workId],
      foreignColumns: [userBooks.id, userBooks.workId],
    }),
    foreignKey({
      columns: [t.editionId, t.workId],
      foreignColumns: [editions.id, editions.workId],
    }),
    uniqueIndex("one_open_attempt")
      .on(t.userBookId)
      .where(sql`${t.state} in ('active', 'paused')`),
    check("session_state", sql`${t.state} in ('active', 'paused', 'completed', 'dnf')`),
    check("progress_unit", sql`${t.unit} in ('page', 'second', 'percent')`),
    check("percent_total", sql`${t.unit} <> 'percent' or ${t.total} is not null`),
    check(
      "session_positions",
      sql`${t.position} >= 0 and (${t.total} is null or (${t.total} > 0 and ${t.position} <= ${t.total})) and (${t.unit} <> 'percent' or ${t.total} = 100)`,
    ),
    check(
      "session_dates",
      sql`(${t.state} not in ('active', 'paused') or ${t.finishedAt} is null) and (${t.startedAt} is null or ${t.finishedAt} is null or ${t.finishedAt} >= ${t.startedAt})`,
    ),
  ],
);

export const progressEntries = v2.table(
  "progress_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    readingSessionId: uuid("reading_session_id")
      .notNull()
      .references(() => readingSessions.id, { onDelete: "restrict" }),
    kind: text("kind").$type<"baseline" | "observation">().notNull(),
    position: integer("position").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("session_progress_history").on(t.readingSessionId, t.createdAt),
    check("entry_kind", sql`${t.kind} in ('baseline', 'observation')`),
    check("entry_position", sql`${t.position} >= 0`),
    check("observed_date", sql`${t.kind} = 'baseline' or ${t.occurredAt} is not null`),
  ],
);

// Successful mutations and their responses commit together; retry never repeats a write.
export const mutationReceipts = v2.table(
  "mutation_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    key: uuid("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    result: jsonb("result").$type<Record<string, JsonValue>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("actor_mutation_key").on(t.userId, t.key)],
);

export const shelves = v2.table(
  "shelves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shelf_user_name").on(t.userId, t.name),
    uniqueIndex("shelf_user_pair").on(t.id, t.userId),
    check("shelf_name_not_blank", sql`length(trim(${t.name})) > 0`),
  ],
);

export const shelfItems = v2.table(
  "shelf_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shelfId: uuid("shelf_id").notNull(),
    userId: integer("user_id").notNull(),
    userBookId: uuid("user_book_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shelf_item_membership").on(t.shelfId, t.userBookId),
    foreignKey({
      columns: [t.shelfId, t.userId],
      foreignColumns: [shelves.id, shelves.userId],
    }),
    foreignKey({
      columns: [t.userBookId, t.userId],
      foreignColumns: [userBooks.id, userBooks.userId],
    }),
  ],
);

export const ratings = v2.table(
  "ratings",
  {
    userBookId: uuid("user_book_id")
      .primaryKey()
      .references(() => userBooks.id, { onDelete: "cascade" }),
    halfStars: integer("half_stars").notNull(),
  },
  (t) => [check("rating_half_stars", sql`${t.halfStars} between 1 and 10`)],
);

export const margins = v2.table(
  "margins",
  {
    id: uuid("id").primaryKey(),
    userBookId: uuid("user_book_id")
      .notNull()
      .references(() => userBooks.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    kind: text("kind").$type<"note" | "quote">().notNull().default("note"),
    locator: text("locator"),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("margin_book_history").on(t.userBookId, t.createdAt),
    check("margin_body_length", sql`length(trim(${t.body})) between 1 and 10000`),
    check("margin_locator_length", sql`${t.locator} is null or length(${t.locator}) <= 120`),
  ],
);

export const legacySyncSnapshots = v2.table(
  "legacy_sync_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    entityKind: text("entity_kind").$type<"book" | "margin" | "goal" | "settings">().notNull(),
    sourceId: text("source_id").notNull(),
    sourceHash: text("source_hash").notNull(),
    payload: jsonb("payload").$type<JsonValue>().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("legacy_sync_source_identity").on(t.userId, t.entityKind, t.sourceId)],
);

export const userBookRelations = relations(userBooks, ({ one, many }) => ({
  work: one(works, { fields: [userBooks.workId], references: [works.id] }),
  sessions: many(readingSessions),
}));
export const sessionRelations = relations(readingSessions, ({ one }) => ({
  userBook: one(userBooks, { fields: [readingSessions.userBookId], references: [userBooks.id] }),
}));
export const shelfRelations = relations(shelves, ({ many }) => ({ items: many(shelfItems) }));
export const shelfItemRelations = relations(shelfItems, ({ one }) => ({
  shelf: one(shelves, { fields: [shelfItems.shelfId], references: [shelves.id] }),
  userBook: one(userBooks, { fields: [shelfItems.userBookId], references: [userBooks.id] }),
}));
