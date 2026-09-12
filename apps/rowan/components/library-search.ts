import { z } from "zod";
export const librarySearch = z.object({
  view: z.enum(["grid", "shelves", "list"]).catch("grid"),
  section: z.enum(["books", "series"]).catch("books"),
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
