export const GUEST_SESSION_PREFIX = "guest:";
export const GUEST_SESSION_TTL_MS = 1000 * 60 * 60 * 24;
export const FULL_AUTH_REQUIRED_MESSAGE = "Sign in or create an account to save changes.";
export const MISSING_OR_EXPIRED_SESSION_MESSAGE =
  "Your session is missing or expired. Sign in to continue.";
export const GUEST_BROWSE_MESSAGE =
  "You are browsing as a guest. Sign in or create an account to save books, notes, and goals.";

/**
 * @param {number} [nowMs]
 * @param {number} [ttlMs]
 */
export function createGuestSessionId(nowMs = Date.now(), ttlMs = GUEST_SESSION_TTL_MS) {
  const expiresAtMs = Math.max(0, Math.floor(nowMs + ttlMs));
  return `${GUEST_SESSION_PREFIX}${expiresAtMs}:${crypto.randomUUID()}`;
}

/**
 * @param {string} sessionId
 */
export function parseGuestSessionId(sessionId) {
  if (!sessionId || !sessionId.startsWith(GUEST_SESSION_PREFIX)) return null;
  const payload = sessionId.slice(GUEST_SESSION_PREFIX.length);
  const [expiresAtRaw, nonce] = payload.split(":");
  if (!expiresAtRaw || !nonce) return null;
  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return null;
  return { expiresAtMs, nonce };
}

/**
 * @param {string} sessionId
 */
export function isGuestSessionId(sessionId) {
  return parseGuestSessionId(sessionId) !== null;
}

/**
 * @param {string} sessionId
 * @param {number} [nowMs]
 */
export function isGuestSessionValid(sessionId, nowMs = Date.now()) {
  const parsed = parseGuestSessionId(sessionId);
  return !!parsed && parsed.expiresAtMs > nowMs;
}

/**
 * @param {string} [displayName]
 */
export function guestUser(displayName = "Guest Reader") {
  return {
    id: 0,
    username: "guest",
    displayName,
    isGuest: true,
  };
}

/**
 * @param {{ isGuest?: boolean } | null} user
 */
export function canUseProtectedActions(user) {
  return !!user && !user.isGuest;
}

/**
 * @param {{ loading: boolean; user: unknown; pathname: string }} params
 */
export function shouldRequireLoginRedirect({ loading, user, pathname }) {
  return !loading && !user && pathname !== "/login" && pathname !== "/";
}
