/** Existing-account mode keeps the original login/session store during the Rowan rollout. */
export function accountDatabaseUrl(env: Record<string, string | undefined>) {
  if (env.ROWAN_STANDALONE !== "true" || env.ROWAN_EXISTING_ACCOUNTS === "true")
    return env.DATABASE_URL;
  return env.ROWAN_DATABASE_URL;
}
