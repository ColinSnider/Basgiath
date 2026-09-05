import test from "node:test";
import assert from "node:assert/strict";
import { completedBooks, completionYears } from "./library-history.ts";

test("past reads retain DNF and current rereads while excluding unread books", () => {
  const books = [
    { id: "dnf", status: "dnf", reads: [{ finishedAt: "2022-06-15T12:00:00Z" }] },
    {
      id: "rereading",
      status: "reading",
      reads: [{ finishedAt: "2024-06-15T12:00:00Z" }, { finishedAt: "2023-06-15T12:00:00Z" }],
    },
    { id: "tbr", status: "wishlist", reads: [] },
    { id: "invalid", status: "finished", reads: [{ finishedAt: "invalid" }] },
  ];
  const original = structuredClone(books);
  assert.deepEqual(
    completedBooks(books).map((book) => book.id),
    ["dnf", "rereading"],
  );
  assert.deepEqual(completionYears(completedBooks(books)), [2024, 2023, 2022]);
  assert.deepEqual(books, original);
});

test("history years deduplicate repeated finishes and discard unknown dates", () => {
  assert.deepEqual(
    completionYears([
      {
        reads: [
          { finishedAt: "2024-04-01T12:00:00Z" },
          { finishedAt: "2024-06-01T12:00:00Z" },
          { finishedAt: "" },
        ],
      },
    ]),
    [2024],
  );
  assert.deepEqual(completedBooks([]), []);
  assert.deepEqual(completionYears([]), []);
});
