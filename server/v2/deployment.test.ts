import test from "node:test";
import assert from "node:assert/strict";
import { accountDatabaseUrl } from "./deployment.ts";

test("standalone authentication never uses a configured legacy database", () => {
  const env = { DATABASE_URL: "postgres://legacy/app", ROWAN_DATABASE_URL: "postgres://rowan/app" };
  assert.equal(accountDatabaseUrl(env), env.DATABASE_URL);
  assert.equal(accountDatabaseUrl({ ...env, ROWAN_STANDALONE: "true" }), env.ROWAN_DATABASE_URL);
  assert.equal(
    accountDatabaseUrl({ DATABASE_URL: env.DATABASE_URL, ROWAN_STANDALONE: "true" }),
    undefined,
  );
});

test("existing-account rollout retains original logins without guessing account identities", () => {
  const env = {
    ROWAN_STANDALONE: "true",
    ROWAN_EXISTING_ACCOUNTS: "true",
    DATABASE_URL: "postgres://original/app",
    ROWAN_DATABASE_URL: "postgres://rowan/app",
  };
  assert.equal(accountDatabaseUrl(env), env.DATABASE_URL);
  assert.equal(accountDatabaseUrl({ ...env, DATABASE_URL: undefined }), undefined);
});
