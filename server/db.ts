import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

import { accountDatabaseUrl } from "./v2/deployment";

const { Pool } = pg;
const connectionString = accountDatabaseUrl(process.env);

if (!connectionString) {
  throw new Error("The application account database must be configured.");
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
