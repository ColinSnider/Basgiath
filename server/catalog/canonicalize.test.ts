import assert from "node:assert/strict";
import test from "node:test";
import { decideCanonicalization, type CatalogCandidate } from "./canonicalize.ts";

const candidate: CatalogCandidate = {
  work: {
    id: "work-1",
    title: "A book",
    authors: ["An Author"],
    coverUrl: null,
    seriesLabel: null,
  },
  edition: null,
  evidence: [],
};

test("canonicalization keeps weak evidence reviewable", () => {
  const result = decideCanonicalization({
    ...candidate,
    evidence: [
      { provider: "openlibrary", entityKind: "author", externalId: "a-1", confidence: "weak" },
    ],
  });
  assert.equal(result.kind, "review");
});

test("canonicalization accepts a strong mapped work", () => {
  const result = decideCanonicalization(
    {
      ...candidate,
      evidence: [
        { provider: "openlibrary", entityKind: "work", externalId: "work-1", confidence: "strong" },
      ],
    },
    [
      {
        provider: "openlibrary",
        entityKind: "work",
        externalId: "work-1",
        workId: "rowan-work-123",
        editionId: null,
      },
    ],
  );
  assert.deepEqual(result, { kind: "existing", workId: "rowan-work-123", editionId: null });
});

test("strong provider evidence alone never becomes an internal ID", () => {
  const result = decideCanonicalization({
    ...candidate,
    evidence: [
      { provider: "openlibrary", entityKind: "work", externalId: "OL123W", confidence: "strong" },
    ],
  });
  assert.equal(result.kind, "provisional");
});

test("same title/author and unrelated or differently namespaced mappings never merge", () => {
  const result = decideCanonicalization(candidate, [
    {
      provider: "openlibrary",
      entityKind: "work",
      externalId: "OL123W",
      workId: "existing",
      editionId: null,
    },
  ]);
  assert.equal(result.kind, "provisional");
});

test("conflicting provider mappings require review", () => {
  const result = decideCanonicalization(
    {
      ...candidate,
      evidence: [
        { provider: "openlibrary", entityKind: "work", externalId: "OL123W", confidence: "strong" },
        { provider: "google", entityKind: "edition", externalId: "volume-2", confidence: "strong" },
      ],
    },
    [
      {
        provider: "openlibrary",
        entityKind: "work",
        externalId: "OL123W",
        workId: "work-a",
        editionId: null,
      },
      {
        provider: "google",
        entityKind: "edition",
        externalId: "volume-2",
        workId: "work-b",
        editionId: "edition-b",
      },
    ],
  );
  assert.equal(result.kind, "review");
});
