export const USERNAME_TAKEN_MESSAGE = "Username already taken";
export const USERNAME_REQUIRED_MESSAGE = "Username is required.";
export const USERNAME_MIN_LENGTH_MESSAGE = "Username must be at least 3 characters.";
export const SIGNUP_SCHEMA_OUT_OF_DATE_MESSAGE =
  "Sign up is temporarily unavailable because the database schema is out of date. Run database migrations and try again.";

type LookupByUsername = (username: string) => Promise<{ id: number } | undefined>;

export function normalizeSignupUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error(USERNAME_REQUIRED_MESSAGE);
  if (normalized.length < 3) throw new Error(USERNAME_MIN_LENGTH_MESSAGE);
  return normalized;
}

function errorChain(error: unknown) {
  const chain: unknown[] = [];
  let current: unknown = error;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current =
      current instanceof Error && "cause" in current
        ? (current as Error & { cause?: unknown }).cause
        : undefined;
  }
  return chain;
}

function hasPgCode(error: unknown, code: string) {
  return errorChain(error).some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "code" in entry &&
      (entry as { code?: unknown }).code === code,
  );
}

function errorText(error: unknown) {
  return errorChain(error)
    .filter((entry): entry is Error => entry instanceof Error)
    .map((entry) => entry.message)
    .join("\n");
}

export function mapSignupDbError(error: unknown) {
  if (error instanceof Error && error.message === USERNAME_TAKEN_MESSAGE) return error;
  if (hasPgCode(error, "23505")) return new Error(USERNAME_TAKEN_MESSAGE);

  const text = errorText(error);
  if (
    hasPgCode(error, "42703") ||
    text.includes('failed query: select "id" from "users" where "users"."username"') ||
    text.includes('where "users"."username" = $1')
  ) {
    return new Error(SIGNUP_SCHEMA_OUT_OF_DATE_MESSAGE);
  }

  return error instanceof Error ? error : new Error("Unable to create account. Please try again.");
}

export async function ensureUsernameAvailable(
  username: string,
  lookupByUsername: LookupByUsername,
) {
  const normalizedUsername = normalizeSignupUsername(username);
  try {
    const existing = await lookupByUsername(normalizedUsername);
    if (existing) throw new Error(USERNAME_TAKEN_MESSAGE);
    return normalizedUsername;
  } catch (error) {
    throw mapSignupDbError(error);
  }
}
