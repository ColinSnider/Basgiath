import { defineConfig } from "drizzle-kit";

// Generation only. Production still uses drizzle.config.ts and migrations/.
export default defineConfig({
  schema: "./shared/schema-v2.ts",
  out: "./migrations-v2",
  dialect: "postgresql",
});
