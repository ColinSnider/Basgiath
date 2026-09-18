import { z } from "zod";
export const goalMetricSchema = z.enum([
  "books",
  "pages",
  "minutes",
  "unique_books",
  "authors",
  "reading_minutes",
  "reading_days",
  "custom",
]);
export const goalLogSchema = z
  .object({
    id: z.string().uuid(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, "Choose a valid date."),
    amount: z
      .number()
      .finite()
      .min(-10000000)
      .max(10000000)
      .refine((value) => value !== 0),
    note: z.string().trim().max(200).default(""),
  })
  .strict();
export const goalSettingsSchema = z
  .object({
    title: z.string().trim().max(100).default(""),
    unit: z.string().trim().max(30).default(""),
    entries: z.array(goalLogSchema).max(10000).default([]),
  })
  .strict()
  .refine((settings) => new Set(settings.entries.map((entry) => entry.id)).size === settings.entries.length, "Duplicate goal progress entries.");
export type GoalSettings = z.infer<typeof goalSettingsSchema>;
