import assert from "node:assert/strict";
import test from "node:test";
import { qualitySearch } from "./search-quality.ts";
import type { WorkSearchResult } from "./open-library-provider.ts";
const book = (title: string, categories: string[] = []): WorkSearchResult => ({
  title,
  categories,
  ref: { provider: "googlebooks", externalId: title },
  authors: [],
  coverUrl: null,
});

test("default search removes explicit merchandise, guides, collections and tagged fanfiction", () => {
  const novel = book("Harry Potter and the Philosopher's Stone");
  const results = [
    book("Harry Potter Poster Book"),
    book("Harry Potter Deluxe Coloring Book"),
    book("Harry Potter (series) 1-7"),
    book("Harry Potter, A Cinematic Guide (e-Book)"),
    book("Harry Potter and the Methods of Rationality", ["Fan fiction"]),
    novel,
  ];
  assert.deepEqual(qualitySearch(results, "Harry Potter"), [novel]);
  assert.equal(qualitySearch(results, "Harry Potter", true).length, results.length);
  assert.equal(qualitySearch(results, "Harry Potter coloring book").length, results.length);
});
test("ordinary books remain and similarly titled records are never merged", () => {
  const results = [
    book("Dune"),
    book("Harry Potter"),
    book("Harry Potter"),
    book("The Hitchhiker's Guide to the Galaxy"),
  ];
  assert.equal(qualitySearch(results, "Harry Potter").length, 4);
  assert.equal(qualitySearch(results, "Harry Potter")[0].title, "Harry Potter");
});
