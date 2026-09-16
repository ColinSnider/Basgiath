import { z } from "zod";
export const librarySearch = z.object({
  page: z.number().int().min(1).max(4167).catch(1),
  view: z.enum(["grid", "shelves", "list"]).catch("grid"),
  section: z.enum(["books", "series", "collections"]).catch("books"),
  collection: z.enum(["", "shelf", "series", "queue"]).catch(""),
  collectionId: z.string().catch(""),
  query: z.string().catch(""),
  status: z.string().catch("all"),
  shelf: z.string().catch(""),
  format: z.string().catch("all"),
  author: z.string().catch(""),
  year: z.string().catch(""),
  favorite: z.boolean().catch(false),
  read: z.boolean().catch(false),
  sort: z
    .enum(["shelf", "title", "author", "newest", "oldest", "finished", "pages"])
    .catch("shelf"),
});
