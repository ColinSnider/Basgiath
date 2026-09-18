import { z } from "zod";

export const browseFields = {
  format: z.enum(["all", "book", "ebook", "audiobook", "unknown"]).default("all"),
  author: z.string().max(500).default(""),
  year: z
    .string()
    .regex(/^(\d{4})?$/)
    .default(""),
  read: z.boolean().default(false),
  collection: z.enum(["", "shelf", "series", "queue"]).default(""),
  collectionId: z.string().uuid().optional(),
  unfiled: z.boolean().default(false),
  timeZone: z
    .string()
    .max(100)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone")
    .default("UTC"),
};
export const browseSchema = z.object(browseFields);
export const browseSort = z.enum([
  "newest",
  "oldest",
  "title",
  "rating",
  "shelf",
  "author",
  "finished",
  "pages",
]);
