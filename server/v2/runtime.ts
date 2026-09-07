import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import { createLibraryService } from "./library-service";
import { createOpenLibraryProvider } from "./open-library-provider";
import { rowanEnabled as enabled } from "./access";
import { createShelfService } from "./shelf-service";

export function rowanEnabled() {
  return enabled(process.env);
}

let runtime: ReturnType<typeof createRuntime> | undefined;
function createRuntime() {
  const database = drizzle(new pg.Pool({ connectionString: process.env.ROWAN_DATABASE_URL }), {
    schema,
  });
  const provider = createOpenLibraryProvider({ userAgent: process.env.OPEN_LIBRARY_USER_AGENT! });
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
