import { z } from "zod";

import type { JsonValue } from "../../shared/json.ts";
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const nullableText = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
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
  status: z.enum(["reading", "finished", "wishlist", "dnf"]),
  addedAt: z.string().datetime(),
  reads: z.array(z.object({ finishedAt: z.string().datetime() })).default([]),
  metadata: z.record(z.string(), jsonValueSchema).default({}),
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

export const importDataSchema = z
  .object({
    books: z.array(importedBookSchema),
    margins: z.array(importedMarginSchema),
    goals: z.array(importedGoalSchema),
    settings: z.object({
      darkMode: z.boolean(),
      accentColor: z.string(),
      compactMode: z.boolean(),
      fontScale: z.enum(["sm", "md", "lg"]),
    }),
  })
  .superRefine((data, ctx) => {
    for (const name of ["books", "margins", "goals"] as const) {
      const seen = new Set<string>();
      data[name].forEach((row, index) => {
        if (seen.has(row.id))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name, index, "id"],
            message: "Duplicate import ID.",
          });
        seen.add(row.id);
      });
    }
    const bookIds = new Set(data.books.map((book) => book.id));
    data.margins.forEach((margin, index) => {
      if (!bookIds.has(margin.bookId))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["margins", index, "bookId"],
          message: "Import references a missing book.",
        });
    });
  });
export type ImportData = z.infer<typeof importDataSchema>;
