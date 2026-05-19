/**
 * Auth configuration sourced from environment variables.
 *
 * AUTH_BCRYPT_ROUNDS  - bcrypt cost factor for password hashing (default: 10)
 * AUTH_SESSION_EXPIRY_DAYS - how many days a session token remains valid (default: 7)
 */

export const authConfig = {
  bcryptRounds: parseInt(process.env["AUTH_BCRYPT_ROUNDS"] ?? "10", 10),
  sessionExpiryDays: parseInt(process.env["AUTH_SESSION_EXPIRY_DAYS"] ?? "7", 10),
} as const;

/** Returns a Date that is `sessionExpiryDays` from now. */
export function sessionExpiresAt(): Date {
  return new Date(Date.now() + authConfig.sessionExpiryDays * 24 * 60 * 60 * 1000);
}
