/** Standalone Rowan never falls back to the Basgiath database. */
export function accountDatabaseUrl(env: Record<string, string | undefined>) {
  return env.ROWAN_STANDALONE === "true" ? env.ROWAN_DATABASE_URL : env.DATABASE_URL;
}
