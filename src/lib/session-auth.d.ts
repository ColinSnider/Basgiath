export const GUEST_SESSION_PREFIX: "guest:";
export const GUEST_SESSION_TTL_MS: number;
export const FULL_AUTH_REQUIRED_MESSAGE: string;
export const MISSING_OR_EXPIRED_SESSION_MESSAGE: string;
export const GUEST_BROWSE_MESSAGE: string;

export function createGuestSessionId(nowMs?: number, ttlMs?: number): string;
export function parseGuestSessionId(
  sessionId: string,
): { expiresAtMs: number; nonce: string } | null;
export function isGuestSessionId(sessionId: string): boolean;
export function isGuestSessionValid(sessionId: string, nowMs?: number): boolean;
export function guestUser(displayName?: string): {
  id: number;
  username: string;
  displayName: string;
  isGuest: boolean;
};
export function canUseProtectedActions(user: { isGuest?: boolean } | null): boolean;
export function shouldRequireLoginRedirect(params: {
  loading: boolean;
  user: unknown;
  pathname: string;
}): boolean;
