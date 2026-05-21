import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchUrl, mapDoc } from "./open-library.ts";

// --- buildSearchUrl ---

test("buildSearchUrl returns a URL starting with the Open Library search base", () => {
  const url = buildSearchUrl("dune");
  assert.ok(url.startsWith("https://openlibrary.org/search.json"));
});

test("buildSearchUrl includes the query, limit, and fields parameters", () => {
  const url = buildSearchUrl("dune");
  const parsed = new URL(url);
  assert.ok(parsed.searchParams.get("q") === "dune");
  assert.ok(parsed.searchParams.has("limit"));
  assert.ok(parsed.searchParams.has("fields"));
});

test("buildSearchUrl encodes special characters in the query", () => {
  const url = buildSearchUrl("cats & dogs");
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("q"), "cats & dogs");
});

test("buildSearchUrl trims whitespace from the query", () => {
  const url = buildSearchUrl("  gatsby  ");
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("q"), "gatsby");
});


test("buildSearchUrl includes an optional language parameter when provided", () => {
  const url = buildSearchUrl("dune", "eng");
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("language"), "eng");
});

// --- mapDoc: non-object inputs ---

test("mapDoc returns null for null", () => {
  assert.equal(mapDoc(null), null);
});

test("mapDoc returns null for undefined", () => {
  assert.equal(mapDoc(undefined), null);
});

test("mapDoc returns null for a string", () => {
  assert.equal(mapDoc("some string"), null);
});

test("mapDoc returns null for a number", () => {
  assert.equal(mapDoc(42), null);
});

test("mapDoc returns null for an array", () => {
  assert.equal(mapDoc([]), null);
});

// --- mapDoc: missing or empty title ---

test("mapDoc returns null when title field is absent", () => {
  assert.equal(mapDoc({ author_name: ["Author"] }), null);
});

test("mapDoc returns null when title is an empty string", () => {
  assert.equal(mapDoc({ title: "", author_name: ["Author"] }), null);
});

test("mapDoc returns null when title is whitespace only", () => {
  assert.equal(mapDoc({ title: "   ", author_name: ["Author"] }), null);
});

test("mapDoc returns null when title is null", () => {
  assert.equal(mapDoc({ title: null, author_name: ["Author"] }), null);
});

test("mapDoc returns null when title is a number", () => {
  assert.equal(mapDoc({ title: 123, author_name: ["Author"] }), null);
});

// --- mapDoc: missing or empty author_name ---

test("mapDoc returns null when author_name field is absent", () => {
  assert.equal(mapDoc({ title: "Test Book" }), null);
});

test("mapDoc returns null when author_name is an empty array", () => {
  assert.equal(mapDoc({ title: "Test Book", author_name: [] }), null);
});

test("mapDoc returns null when author_name contains only empty strings", () => {
  assert.equal(mapDoc({ title: "Test Book", author_name: ["", "   "] }), null);
});

test("mapDoc returns null when author_name is null", () => {
  assert.equal(mapDoc({ title: "Test Book", author_name: null }), null);
});

test("mapDoc returns null when author_name is a string instead of an array", () => {
  assert.equal(mapDoc({ title: "Test Book", author_name: "Author" }), null);
});

// --- mapDoc: successful mapping ---

test("mapDoc maps a fully populated doc to a SearchResult", () => {
  const result = mapDoc({
    key: "/works/OL123W",
    title: "The Great Gatsby",
    author_name: ["F. Scott Fitzgerald"],
    cover_i: 123456,
    number_of_pages_median: 180,
  });
  assert.ok(result !== null);
  assert.equal(result.key, "/works/OL123W");
  assert.equal(result.title, "The Great Gatsby");
  assert.equal(result.author, "F. Scott Fitzgerald");
  assert.equal(result.coverUrl, "https://covers.openlibrary.org/b/id/123456-M.jpg");
  assert.equal(result.totalPages, 180);
  assert.equal(result.source, "openlibrary");
  assert.equal(result.sourceUrl, "https://openlibrary.org/works/OL123W");
});

test("mapDoc trims whitespace from title and author", () => {
  const result = mapDoc({
    key: "/works/OL1W",
    title: "  Trimmed Title  ",
    author_name: ["  Trimmed Author  "],
  });
  assert.ok(result !== null);
  assert.equal(result.title, "Trimmed Title");
  assert.equal(result.author, "Trimmed Author");
});

test("mapDoc picks the first non-empty author from a multi-author list", () => {
  const result = mapDoc({
    key: "/works/OL2W",
    title: "Multi Author",
    author_name: ["", "First Valid Author", "Second Author"],
  });
  assert.ok(result !== null);
  assert.equal(result.author, "First Valid Author");
});

test("mapDoc omits coverUrl when cover_i is absent", () => {
  const result = mapDoc({
    key: "/works/OL3W",
    title: "No Cover",
    author_name: ["Author"],
  });
  assert.ok(result !== null);
  assert.equal(result.coverUrl, undefined);
});

test("mapDoc omits coverUrl when cover_i is not a number", () => {
  const result = mapDoc({
    key: "/works/OL3W",
    title: "No Cover",
    author_name: ["Author"],
    cover_i: "not-a-number",
  });
  assert.ok(result !== null);
  assert.equal(result.coverUrl, undefined);
});

test("mapDoc omits totalPages when number_of_pages_median is zero", () => {
  const result = mapDoc({
    key: "/works/OL4W",
    title: "Zero Pages",
    author_name: ["Author"],
    number_of_pages_median: 0,
  });
  assert.ok(result !== null);
  assert.equal(result.totalPages, undefined);
});

test("mapDoc omits totalPages when number_of_pages_median is negative", () => {
  const result = mapDoc({
    key: "/works/OL5W",
    title: "Negative Pages",
    author_name: ["Author"],
    number_of_pages_median: -5,
  });
  assert.ok(result !== null);
  assert.equal(result.totalPages, undefined);
});

test("mapDoc omits totalPages when number_of_pages_median is absent", () => {
  const result = mapDoc({
    key: "/works/OL6W",
    title: "No Pages",
    author_name: ["Author"],
  });
  assert.ok(result !== null);
  assert.equal(result.totalPages, undefined);
});

test("mapDoc rounds fractional page counts", () => {
  const result = mapDoc({
    key: "/works/OL7W",
    title: "Fractional Pages",
    author_name: ["Author"],
    number_of_pages_median: 299.7,
  });
  assert.ok(result !== null);
  assert.equal(result.totalPages, 300);
});

test("mapDoc generates a fallback key when key field is absent", () => {
  const result = mapDoc({
    title: "No Key Book",
    author_name: ["Author"],
  });
  assert.ok(result !== null);
  assert.ok(typeof result.key === "string" && result.key.length > 0);
  assert.ok(result.key.startsWith("doc-"));
  assert.ok(/^doc-[a-z0-9-]+$/.test(result.key));
});

test("mapDoc fallback key handles special characters and long titles", () => {
  const longTitle = "A".repeat(200);
  const result = mapDoc({
    title: longTitle,
    author_name: ["Author"],
  });
  assert.ok(result !== null);
  assert.ok(result.key.length <= 54); // "doc-" (4) + max 50 slug chars
  assert.ok(result.key.startsWith("doc-"));
});


test("mapDoc maps additional Open Library metadata", () => {
  const result = mapDoc({
    key: "/works/OL999W",
    title: "Metadata Book",
    author_name: ["Author"],
    language: ["eng", "spa"],
    first_publish_year: 1999,
    publish_year: [2000, 2005],
    edition_count: 12,
    isbn: ["123", "456"],
    publisher: ["Pub A", "Pub B"],
  });
  assert.ok(result !== null);
  assert.deepEqual(result.languageCodes, ["eng", "spa"]);
  assert.equal(result.firstPublishYear, 1999);
  assert.equal(result.publishYear, 2005);
  assert.equal(result.editionCount, 12);
  assert.deepEqual(result.isbn, ["123", "456"]);
  assert.deepEqual(result.publisher, ["Pub A", "Pub B"]);
});
