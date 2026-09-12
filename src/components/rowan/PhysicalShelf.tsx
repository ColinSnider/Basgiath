import type { rowanLibrary } from "@/lib/rowan-fns";
import { BookSpine } from "./BookSpine";
import { useEffect, useRef, useState } from "react";
type Book = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];
export function ShelfBooks({
  books,
  view,
  openBook,
}: {
  books: Book[];
  view: "shelves" | "stacks";
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
  const rows: Array<{ books: Book[]; upright: number }> = [];
  for (let i = 0; i < books.length; ) {
    let upright = 0,
      used = 0;
    const remaining = books.length - i;
    const limit = Math.min(4, remaining > 2 ? remaining - 2 : remaining);
    if (view === "shelves")
      while (upright < limit) {
        const book = books[i + upright];
        const spineWidth = Math.round(
          Math.max(
            24,
            Math.min(86, 14 + (book.format === "audiobook" ? 350 : (book.total ?? 300)) * 0.06),
          ),
        );
        if (upright && used + spineWidth > width - (remaining > 2 ? 176 : 14)) break;
        used += spineWidth + 3;
        upright++;
      }
    const count =
      view === "stacks"
        ? Math.min(6, remaining)
        : Math.min(remaining, upright + (remaining > 2 ? 2 : 0));
    rows.push({ books: books.slice(i, i + count), upright });
    i += count;
  }
  return (
    <div className="reader-shelf-boards" ref={container}>
      {!books.length && <div className="reader-shelf-empty">Room for your next book.</div>}
      {rows.map(({ books: row, upright }, i) => (
        <div className="reader-shelf-board" key={i}>
          {view === "shelves" && (
            <div className="reader-shelf-upright">
              {row.slice(0, upright).map((book) => (
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
          )}
          <div className="reader-horizontal-stack">
            {(view === "stacks" ? row : row.slice(upright)).map((book) => (
              <button
                className="reader-horizontal-book"
                key={book.id}
                title={`${book.title} — ${book.authors.join(", ")}`}
                aria-label={`Open ${book.title}`}
                style={{
                  minHeight: Math.max(
                    25,
                    Math.min(
                      55,
                      17 + (book.format === "audiobook" ? 350 : (book.total ?? 300)) * 0.035,
                    ),
                  ),
                }}
                onClick={() => openBook(book)}
              >
                <span>{book.title}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
