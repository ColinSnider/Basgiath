import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureUsernameAvailable,
  mapSignupDbError,
  normalizeSignupUsername,
  SIGNUP_SCHEMA_OUT_OF_DATE_MESSAGE,
  USERNAME_MIN_LENGTH_MESSAGE,
  USERNAME_REQUIRED_MESSAGE,
  USERNAME_TAKEN_MESSAGE,
} from "./auth-signup.ts";

test("normalizeSignupUsername lowercases and trims a valid new username", () => {
  assert.equal(normalizeSignupUsername("  Colon  "), "colon");
});

test("ensureUsernameAvailable resolves for a valid username that does not exist", async () => {
  const username = await ensureUsernameAvailable("colon", async () => undefined);
  assert.equal(username, "colon");
});

test("ensureUsernameAvailable throws for duplicate usernames", async () => {
  await assert.rejects(
    () => ensureUsernameAvailable("colon", async () => ({ id: 1 })),
    (error) => {
      assert.equal(error.message, USERNAME_TAKEN_MESSAGE);
      return true;
    },
  );
});

test("ensureUsernameAvailable throws for malformed or empty usernames", async () => {
  assert.throws(() => normalizeSignupUsername(""), new Error(USERNAME_REQUIRED_MESSAGE));
  assert.throws(() => normalizeSignupUsername("  "), new Error(USERNAME_REQUIRED_MESSAGE));
  assert.throws(() => normalizeSignupUsername("ab"), new Error(USERNAME_MIN_LENGTH_MESSAGE));
});

test("mapSignupDbError maps the reported failed query regression to actionable signup guidance", () => {
  const mapped = mapSignupDbError(
    new Error(
      'failed query: select "id" from "users" where "users"."username" = $1\nparams: colon',
    ),
  );
  assert.equal(mapped.message, SIGNUP_SCHEMA_OUT_OF_DATE_MESSAGE);
});
