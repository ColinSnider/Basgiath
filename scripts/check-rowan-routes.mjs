import assert from "node:assert/strict";

// Exercise built SSR routes without a listener, credentials, or a live database.
process.env.ROWAN_STANDALONE = "true";
process.env.ROWAN_DATABASE_URL = "postgres://127.0.0.1:1/rowan_route_check";
process.env.ROWAN_V2_ENABLED = "true";
process.env.ROWAN_V2_ENV = "staging";
process.env.OPEN_LIBRARY_USER_AGENT = "Rowan route check";
delete process.env.DATABASE_URL;
const { default: server } = await import("../dist-rowan/server/server.js");
for (const [path, title] of [
  ["/", "Home"],
  ["/library", "All books"],
  ["/search", "Find books"],
  ["/calendar", "Calendar"],
  ["/insights", "Insights"],
  ["/goals", "Goals"],
  ["/margins", "Margins"],
  ["/settings", "Settings"],
]) {
  const response = await server.fetch(new Request(`http://localhost${path}`));
  assert.equal(response.status, 200, path);
  assert.ok((await response.text()).includes(`Rowan — ${title}`), path);
  console.log(`${path}: Rowan ${title}`);
}
const missing = await server.fetch(new Request("http://localhost/profile"));
assert.equal(missing.status, 404);
console.log("/profile: 404 (legacy route absent)");
