import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleBooksProvider } from "./google-books-provider.ts";

test("Google volumes retain edition identity, deduplicate requests and preserve subtitles", async () => {
  let requests = 0;
  const record = {
    id: "abc_123",
    volumeInfo: {
      title: "Harry Potter",
      subtitle: "Poster Book",
      authors: ["Author"],
      pageCount: 40,
      publisher: "Example Press",
      publishedDate: "2024-05-01",
      language: "en",
      industryIdentifiers: [{ type: "ISBN_13", identifier: "9781234567890" }, { type: "OTHER", identifier: "internal" }],
      imageLinks: { thumbnail: "http://books.google.com/cover" },
    },
  };
  const provider = createGoogleBooksProvider({
    apiKey: "fixture-secret",
    fetchImpl: async (input) => {
      requests++;
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("key"), "fixture-secret");
      return Response.json(
        url.pathname.endsWith("abc_123")
          ? record
          : { items: [record, record, { id: "invalid/url" }] },
      );
    },
  });
  const [first, second] = await Promise.all([
    provider.search("harry potter"),
    provider.search("harry potter"),
  ]);
  assert.deepEqual(first, second);
  assert.equal(requests, 1);
  assert.equal(first.length, 1);
  assert.equal(first[0].title, "Harry Potter: Poster Book");
  assert.equal(first[0].ref.provider, "googlebooks");
  assert.equal(first[0].publisher, "Example Press");
  assert.equal(first[0].publishedDate, "2024-05-01");
  assert.equal(first[0].language, "en");
  assert.equal(first[0].pageCount, 40);
  assert.deepEqual(first[0].isbns, ["9781234567890"]);
  assert.ok(first[0].coverUrl?.startsWith("https:"));
  const details = await provider.fetchWork(first[0].ref);
  assert.equal(details.edition?.externalId, "abc_123");
  assert.equal(details.edition?.pageCount, 40);
  await assert.rejects(provider.fetchWork({ provider: "googlebooks", externalId: "../private" }));
  assert.equal(requests, 2);
});

test("Google quota failures cool down and never expose request credentials", async () => {
  let requests = 0;
  const provider = createGoogleBooksProvider({
    apiKey: "fixture-secret",
    fetchImpl: async () => {
      requests++;
      return new Response("fixture-secret", { status: 429 });
    },
  });
  await assert.rejects(
    provider.search("book"),
    (error: Error) => !error.message.includes("fixture-secret"),
  );
  await assert.rejects(provider.search("another book"));
  assert.equal(requests, 1);
});

test("empty Google results are valid", async () => {
  const provider = createGoogleBooksProvider({
    apiKey: "fixture",
    fetchImpl: async () => Response.json({ totalItems: 0 }),
  });
  assert.deepEqual(await provider.search("missing"), []);
});
