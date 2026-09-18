import { z } from "zod";
export const readDates = z
  .object({
    startedAt: z.string().datetime({ offset: true }).nullable(),
    finishedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .refine(
    (d) => !d.startedAt || !d.finishedAt || new Date(d.startedAt) <= new Date(d.finishedAt),
    "Finish date must be on or after start date.",
  );
export const backlogRow = z
  .object({
    userBookId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(500),
    author: z.string().trim().max(300),
    format: z.enum(["book", "ebook", "audiobook"]),
    total: z.number().int().positive().max(10000000).nullable(),
    reads: z.number().int().min(0).max(100),
    startedAt: z.string().datetime({ offset: true }).nullable(),
    finishedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .superRefine((row, ctx) => {
    if (!readDates.safeParse(row).success)
      ctx.addIssue({ code: "custom", message: "Finish date must be on or after start date." });
    if (!row.reads && (row.startedAt || row.finishedAt))
      ctx.addIssue({ code: "custom", message: "Dates require at least one completed read." });
  });
export const backlogImport = z
  .object({ key: z.string().uuid(), rows: z.array(backlogRow).min(1).max(500) })
  .strict()
  .refine(
    (data) => data.rows.reduce((sum, row) => sum + row.reads, 0) <= 2000,
    "Import at most 2,000 completed reads at a time.",
  );
export const historyChange = z
  .object({
    key: z.string().uuid(),
    userBookId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
    sessionId: z.string().uuid().optional(),
    action: z.enum(["add", "dates", "remove"]),
    count: z.number().int().min(1).max(100).default(1),
    startedAt: z.string().datetime({ offset: true }).nullable(),
    finishedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .refine((d) => readDates.safeParse(d).success, "Finish date must be on or after start date.");
