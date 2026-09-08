/** Development only: compare database identities rather than full URLs/passwords. */
export function rowanEnabled(env: Record<string, string | undefined>) {
  if (
    env.ROWAN_V2_ENV !== "staging" ||
    env.ROWAN_V2_ENABLED !== "true" ||
    !env.OPEN_LIBRARY_USER_AGENT?.trim()
  )
    return false;
  try {
    const targetUrl = env.ROWAN_DATABASE_URL ?? "";
    if (env.ROWAN_STANDALONE === "true") {
      return ["postgres:", "postgresql:"].includes(new URL(targetUrl).protocol);
    }
    const source = new URL(env.DATABASE_URL ?? "");
    const target = new URL(env.ROWAN_DATABASE_URL ?? "");
    const identity = (url: URL) => `${url.hostname}:${url.port || "5432"}${url.pathname}`;
    return (
      [source, target].every((url) => ["postgres:", "postgresql:"].includes(url.protocol)) &&
      identity(source) !== identity(target)
    );
  } catch {
    return false;
  }
}
