import { fileURLToPath } from "node:url";

// Bootstrap and every standalone startup must use the same journal.
export const rowanMigrationConfig = {
  migrationsFolder: fileURLToPath(new URL("../migrations-v2", import.meta.url)),
};
