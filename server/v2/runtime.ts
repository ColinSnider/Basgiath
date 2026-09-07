import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import { createLibraryService } from "./library-service";
import { createOpenLibraryProvider } from "./open-library-provider";
import { rowanEnabled as enabled } from "./access";
import { createShelfService } from "./shelf-service";
import { createGoogleBooksProvider } from "./google-books-provider";

export function rowanEnabled() {
  return enabled(process.env);
}

let runtime: ReturnType<typeof createRuntime> | undefined;
function createRuntime() {
  const database = drizzle(new pg.Pool({ connectionString: process.env.ROWAN_DATABASE_URL }), {
    schema,
  });
  const openLibrary = createOpenLibraryProvider({
    userAgent: process.env.OPEN_LIBRARY_USER_AGENT!,
  });
  const google =
    process.env.GOOGLE_BOOKS_ENABLED === "true" && process.env.GOOGLE_BOOKS_API_KEY?.trim()
      ? createGoogleBooksProvider({ apiKey: process.env.GOOGLE_BOOKS_API_KEY })
      : null;
  const provider = {
    async search(query: string, source: "openlibrary" | "googlebooks" = "openlibrary") {
      if (source === "googlebooks") {
        if (!google) throw new Error("Google Books is not configured.");
        return google.search(query);
      }
      return openLibrary.search(query);
    },
    fetchWork(ref: { provider: string; externalId: string }) {
      if (ref.provider === "googlebooks") {
        if (!google) throw new Error("Google Books is not configured.");
        return google.fetchWork(ref);
      }
      return openLibrary.fetchWork(ref);
    },
  };
  return {
    database,
    provider,
    library: createLibraryService(database, provider),
    shelfService: createShelfService(database),
  };
}
export function getRowanRuntime() {
  if (!rowanEnabled()) throw new Error("Rowan development workspace is disabled.");
  return (runtime ??= createRuntime());
}
