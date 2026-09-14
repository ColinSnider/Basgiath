import assert from "node:assert/strict";
import test from "node:test";
import { createOpenLibraryProvider } from "./open-library-provider.ts";
test("metadata lookup uses the work endpoint and fetches author and synopsis without search mappings", async () => {
  const paths:string[] = [];
  const provider = createOpenLibraryProvider({userAgent:"Rowan tests",intervalMs:0,fetchImpl:async url => {paths.push(String(url));return String(url).includes("authors") ? Response.json({name:"An Author"}) : Response.json({title:"A book",description:{value:"Synopsis"},covers:[-1,123],authors:[{author:{key:"/authors/OL1A"}}]});}});
  const data = await provider.fetchMetadata({provider:"openlibrary",externalId:"/works/OL1W"});
  assert.equal(data.description,"Synopsis");
  assert.deepEqual(data.authors,["An Author"]);
  assert.equal(data.coverUrl,"https://covers.openlibrary.org/b/id/123-L.jpg");
  assert.ok(paths.every(path=>!path.includes("search.json")));
});

test("saving a search result survives a subsequent work lookup outage", async () => {
  let searchRequests = 0;
  const provider = createOpenLibraryProvider({
    userAgent: "Rowan test fixture",
    intervalMs: 0,
    fetchImpl: async (url) => {
      if (String(url).includes("editions.json")) return new Response("", { status: 503 });
      searchRequests++;
      if (searchRequests > 1) throw new Error("Search temporarily offline");
      return Response.json({ docs: [{ key: "/works/OL1W", title: "Saved from search" }] });
    },
  });
  const [result] = await provider.search("Book");
  const work = await provider.fetchWork(result.ref);
  assert.equal(work.title, "Saved from search");
  assert.equal(work.edition, null);
  assert.equal(searchRequests, 1);
});

test("search collapses work keys, rejects malformed IDs and deduplicates concurrent requests", async () => {
  let count = 0;
  const provider = createOpenLibraryProvider({
    userAgent: "Rowan test fixture",
    intervalMs: 0,
    fetchImpl: async (url, options) => {
      count++;
      assert.ok(String(url).startsWith("https://openlibrary.org/search.json?"));
      assert.equal(options?.redirect, "error");
      return Response.json({
        docs: [
          { key: "/works/OL1W", title: "Book", author_name: ["Author"] },
          { key: "/works/OL1W", title: "Another edition" },
          { key: "made-up", title: "Bad key" },
          { key: "/works/OL2W", title: "Different work", cover_i: 42 },
        ],
      });
    },
  });
  const [a, b] = await Promise.all([provider.search("Book"), provider.search("Book")]);
  assert.equal(count, 1);
  assert.equal(a.length, 2);
  assert.deepEqual(a, b);
  await provider.search("Book");
  assert.equal(count, 1);
});

test("work lookup keeps actual edition length and never treats work median pages as edition data", async () => {
  const provider = createOpenLibraryProvider({
    userAgent: "Rowan test fixture",
    intervalMs: 0,
    fetchImpl: async (url) =>
      Response.json(
        String(url).includes("editions.json")
          ? {
              entries: [
                {
                  key: "/books/OL2M",
                  number_of_pages: 321,
                  languages: [{ key: "/languages/eng" }],
                },
              ],
            }
          : { docs: [{ key: "/works/OL1W", title: "Book", number_of_pages_median: 900 }] },
      ),
  });
  const work = await provider.fetchWork({ provider: "openlibrary", externalId: "/works/OL1W" });
  assert.equal(work.edition?.pageCount, 321);
  assert.equal(work.edition?.format, "unknown");
  assert.equal(work.edition?.externalId, "/books/OL2M");
});

test("edition failure preserves work, invalid URLs/IDs never reach the network", async () => {
  let count = 0;
  const provider = createOpenLibraryProvider({
    userAgent: "Rowan test fixture",
    intervalMs: 0,
    fetchImpl: async (url) => {
      count++;
      return String(url).includes("editions.json")
        ? new Response("", { status: 503 })
        : Response.json({ docs: [{ key: "/works/OL1W", title: "Book" }] });
    },
  });
  const work = await provider.fetchWork({ provider: "openlibrary", externalId: "/works/OL1W" });
  assert.equal(work.edition, null);
  assert.equal(work.title, "Book");
  await assert.rejects(
    provider.fetchWork({ provider: "openlibrary", externalId: "https://internal.invalid/secrets" }),
  );
  await assert.rejects(provider.fetchWork({ provider: "other", externalId: "/works/OL1W" }));
  assert.equal(count, 2);
});
