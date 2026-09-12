import type { rowanLibrary } from "@/lib/rowan-fns";
import { BookSpine } from "./BookSpine";
import { useEffect, useRef, useState } from "react";
type Book = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];

// Decorative books never stand in for a saved title or participate in navigation.
export function ShelfBooks({
  books,
  openBook,
}: {
  books: Book[];
  view?: "shelves";
  openBook: (book: Book) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const rows: Book[][] = [];
  let row: Book[] = [],
    used = 0;
  for (const book of books) {
    const size =
      Math.round(
        Math.max(
          24,
          Math.min(86, 14 + (book.format === "audiobook" ? 350 : (book.total ?? 300)) * 0.06),
        ),
      ) + 4;
    if (row.length && used + size > Math.max(100, width - 114)) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(book);
    used += size;
  }
  if (row.length || !rows.length) rows.push(row);
  return (
    <div className="reader-shelf-boards" ref={container}>
      {rows.map((row, index) => (
        <div className="reader-shelf-board" key={index}>
          <div className="reader-shelf-upright">
            {row.map((book) => (
              <button
                title={book.title}
                aria-label={`Open ${book.title}`}
                className="reader-book-spine-button"
                key={book.id}
                onClick={() => openBook(book)}
              >
                <BookSpine book={book} />
              </button>
            ))}
          </div>
          <div
            className={`reader-shelf-silhouettes shelf-arrangement-${index % 4}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}
