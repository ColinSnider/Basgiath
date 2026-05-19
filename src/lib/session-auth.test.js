import test from "node:test";
import assert from "node:assert/strict";
import {
  createGuestSessionId,
  parseGuestSessionId,
  isGuestSessionId,
  isGuestSessionValid,
  canUseProtectedActions,
  shouldRequireLoginRedirect,
} from "./session-auth.js";

test("createGuestSessionId creates a valid guest session", () => {
  const now = 1_000_000;
  const sessionId = createGuestSessionId(now, 5_000);
  const parsed = parseGuestSessionId(sessionId);

  assert.ok(parsed);
  assert.equal(parsed.expiresAtMs, now + 5_000);
  assert.equal(isGuestSessionId(sessionId), true);
  assert.equal(isGuestSessionValid(sessionId, now + 4_000), true);
});

test("guest session expires as expected", () => {
  const now = 1_000_000;
  const sessionId = createGuestSessionId(now, 5_000);
  assert.equal(isGuestSessionValid(sessionId, now + 5_000), false);
  assert.equal(isGuestSessionValid(sessionId, now + 6_000), false);
});

test("parseGuestSessionId returns null for invalid or missing session tokens", () => {
  assert.equal(parseGuestSessionId(""), null);
  assert.equal(parseGuestSessionId("abc"), null);
  assert.equal(parseGuestSessionId("guest:abc:def"), null);
  assert.equal(parseGuestSessionId("guest:123"), null);
});

test("route guard redirects unauthenticated users but not guests", () => {
  assert.equal(
    shouldRequireLoginRedirect({ loading: false, user: null, pathname: "/library" }),
    true,
  );
  assert.equal(shouldRequireLoginRedirect({ loading: false, user: null, pathname: "/" }), false);
  assert.equal(
    shouldRequireLoginRedirect({ loading: false, user: { isGuest: true }, pathname: "/library" }),
    false,
  );
});

test("protected actions require a full authenticated account", () => {
  assert.equal(canUseProtectedActions(null), false);
  assert.equal(canUseProtectedActions({ isGuest: true }), false);
  assert.equal(canUseProtectedActions({ isGuest: false }), true);
});
