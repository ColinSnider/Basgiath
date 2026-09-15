import type { rowanLibrary } from "@/lib/rowan-fns";
type LibraryBook = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];
export function BookSpine({ book }: { book: LibraryBook }) {
  const width = Math.round(
    Math.max(
      24,
      Math.min(86, 14 + (book.format === "audiobook" ? 350 : (book.total ?? 300)) * 0.06),
    ),
  );
  const initials = book.authors
    .join(" ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const completed = book.status === "read" || book.status === "reading";
  return (
    <div
      className={`reader-book-spine reader-book-spine-${book.status}`}
      style={{ width }}
      aria-label={`${book.title} spine`}
    >
      <span className="reader-book-spine-sheen" aria-hidden="true" />
      {completed && <span className="reader-book-spine-band" aria-hidden="true" />}
      <span className="reader-book-spine-author">{initials || "R"}</span>
      <span className="reader-book-spine-title">{book.title}</span>
      <span className="reader-book-spine-meta">
        {book.total ? `${book.total}${book.format === "audiobook" ? "s" : "p"}` : ""}
      </span>
    </div>
  );
}
