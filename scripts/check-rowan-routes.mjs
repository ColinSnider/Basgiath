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
  ["/library", "Shelves"],
  ["/search", "Search"],
  ["/calendar", "History"],
  ["/goals", "Goals"],
  ["/margins", "Margins"],
  ["/account", "Account"],
  ["/books/11111111-1111-4111-8111-111111111111", "Book details"],
]) {
  const response = await server.fetch(new Request(`http://localhost${path}`));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes(`<h1>${title}</h1>`), `${path}: distinct page heading`);
  assert.ok(html.includes(`<title>${title} — Rowan</title>`), `${path}: page title`);
  assert.ok(!html.includes("Rowan datapoints"), `${path}: no static fallback`);
  assert.ok(!html.includes("rowan-workspace"), `${path}: no monolithic workspace`);
  console.log(`${path}: Rowan ${title}`);
}
const missing = await server.fetch(new Request("http://localhost/profile"));
assert.equal(missing.status, 404);
console.log("/profile: 404 (legacy route absent)");
const settings = await server.fetch(new Request("http://localhost/settings"));
assert.equal(settings.status, 307);
assert.equal(settings.headers.get("location"), "/account");
console.log("/settings: redirects to /account");

const insights = await server.fetch(new Request("http://localhost/insights"));
assert.equal(insights.status, 307);
assert.equal(insights.headers.get("location"), "/calendar");
console.log("/insights: redirects to unified history");
