import test from "node:test";
import assert from "node:assert/strict";
import { rowanEnabled } from "./access.ts";

test("Rowan requires explicit development activation and a distinct database", () => {
  const env = {
    NODE_ENV: "production",
    ROWAN_V2_ENV: "staging",
    ROWAN_V2_ENABLED: "true",
    DATABASE_URL: "postgres://localhost/legacy",
    ROWAN_DATABASE_URL: "postgres://localhost/rowan",
    OPEN_LIBRARY_USER_AGENT: "Rowan development",
  };
  assert.equal(rowanEnabled(env), true);
  assert.equal(rowanEnabled({ ...env, ROWAN_V2_ENV: undefined }), false);
  assert.equal(rowanEnabled({ ...env, ROWAN_V2_ENABLED: undefined }), false);
  assert.equal(
    rowanEnabled({
      ...env,
      ROWAN_DATABASE_URL: "postgresql://other:password@localhost:5432/legacy?sslmode=disable",
    }),
    false,
  );
  assert.equal(rowanEnabled({ ...env, ROWAN_DATABASE_URL: "invalid" }), false);
  assert.equal(rowanEnabled({ ...env, OPEN_LIBRARY_USER_AGENT: " " }), false);
});
