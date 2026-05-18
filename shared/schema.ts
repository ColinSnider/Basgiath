import { pgTable, text, integer, boolean, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password"),
  displayName: text("display_name").notNull().default("Reader"),
  email: text("email"),
  replitId: text("replit_id").unique(),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const books = pgTable("books", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  coverUrl: text("cover_url"),
  format: text("format").notNull().default("book"),
  totalPages: integer("total_pages"),
  currentPage: integer("current_page").default(0),
  durationMinutes: integer("duration_minutes"),
  currentMinute: integer("current_minute").default(0),
  status: text("status").notNull().default("reading"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  reads: jsonb("reads").$type<{ finishedAt: string }[]>().notNull().default([]),
});

export const margins = pgTable("margins", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  text: text("text").notNull(),
  page: integer("page"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  target: integer("target").notNull(),
  timeframe: text("timeframe").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSettings = pgTable("user_settings", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  darkMode: boolean("dark_mode").notNull().default(false),
  accentColor: text("accent_color").notNull().default("default"),
  compactMode: boolean("compact_mode").notNull().default(false),
  fontScale: text("font_scale").notNull().default("md"),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  books: many(books),
  margins: many(margins),
  goals: many(goals),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, { fields: [books.userId], references: [users.id] }),
  margins: many(margins),
}));

export const marginsRelations = relations(margins, ({ one }) => ({
  user: one(users, { fields: [margins.userId], references: [users.id] }),
  book: one(books, { fields: [margins.bookId], references: [books.id] }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
}));

export const settingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type BookRow = typeof books.$inferSelect;
export type MarginRow = typeof margins.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type UserSettingsRow = typeof userSettings.$inferSelect;
