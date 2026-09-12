import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { rowanMigrationConfig } from "./rowan-migration-config.mjs";

if (process.env.ROWAN_V2_ENV !== "staging" || !process.env.ROWAN_DATABASE_URL) {
  throw new Error(
    "Set ROWAN_V2_ENV=staging and ROWAN_DATABASE_URL for a dedicated Rowan staging database.",
  );
}
const target = new URL(process.env.ROWAN_DATABASE_URL);
const identity = (url) => `${url.hostname}:${url.port || "5432"}${url.pathname}`;
if (!["postgres:", "postgresql:"].includes(target.protocol))
  throw new Error("A PostgreSQL URL is required.");
if (process.env.DATABASE_URL && identity(target) === identity(new URL(process.env.DATABASE_URL))) {
  throw new Error("Rowan bootstrap must not target the Basgiath database.");
}
const pool = new pg.Pool({ connectionString: process.env.ROWAN_DATABASE_URL });
try {
  const database = drizzle(pool);
  // Account tables still use the compatible public schema. Distinct journals
  // keep the newer legacy timestamps from skipping the v2 foundation.
  await migrate(database, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
  await migrate(database, rowanMigrationConfig);
  console.log("Rowan staging schema is ready.");
} finally {
  await pool.end();
}
