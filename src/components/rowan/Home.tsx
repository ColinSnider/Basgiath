import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Bookmark, CircleCheck, Library, Pause } from "lucide-react";
import { rowanHome } from "@/lib/rowan-fns";

type HomeData = Awaited<ReturnType<typeof rowanHome>>;
type Book = HomeData["next"][number];

export function RowanHome({
  sessionId,
  openBook,
  showLibrary,
}: {
  sessionId: string;
  openBook: (book: Book) => void;
  showLibrary: () => void;
}) {
  const home = useQuery({
    queryKey: ["rowan", sessionId, "home"],
    queryFn: () => rowanHome({ data: { sessionId } }),
    retry: false,
  });
  if (home.isPending)
    return (
      <p role="status" className="reader-state">
        Getting your bookmark ready…
      </p>
    );
  if (home.isError)
    return (
      <div role="alert" className="reader-state">
        Your books could not load. <button onClick={() => void home.refetch()}>Try again</button>
      </div>
    );
  const data = home.data;
  return (
    <section aria-label="Your reading overview" className="reader-reading-layout">
      <section className="reader-card reader-current" aria-labelledby="current-heading">
        <header className="reader-card-heading">
          <div className="reader-section-title">
            <span className="reader-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <h2 id="current-heading">On your nightstand</h2>
              <p>Pick up where you left off.</p>
            </div>
          </div>
          <span className="reader-count">
            {data.current.length}
            {data.hasMoreCurrent ? "+" : ""}
          </span>
        </header>
        {data.current.length ? (
          <ul className="reader-current-list">
            {data.current.map((item) => {
              const total = item.unit === "percent" ? 100 : item.total;
              const percent =
                total && total > 0
                  ? Math.min(100, Math.round((item.position / total) * 100))
                  : null;
              return (
                <li key={item.book.id}>
                  <BookCard book={item.book} openBook={openBook} />
                  <div className="reader-current-progress">
                    <div className="reader-progress-label">
                      <span>
                        {item.state === "paused" && (
                          <span className="reader-paused">
                            <Pause size={12} />
                            Paused ·{" "}
                          </span>
                        )}
                        {positionLabel(item.position, item.unit)}
                        {item.unit !== "percent" && total !== null
                          ? ` of ${positionLabel(total, item.unit)}`
                          : ""}
                      </span>
                      {percent !== null && <strong>{percent}%</strong>}
                    </div>
                    {percent !== null ? (
                      <progress
                        value={item.position}
                        max={total!}
                        aria-label={`Progress for ${item.book.title}`}
                      />
                    ) : (
                      <p className="reader-caption">Book length not set</p>
                    )}
                  </div>
                  <button className="reader-text-link" onClick={() => openBook(item.book)}>
                    {item.state === "paused" ? "Open paused read" : "Continue reading"}
                    <ArrowRight size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="reader-empty">
            <BookOpen size={34} strokeWidth={1.2} aria-hidden="true" />
            <h3>A bookmark waiting for a story</h3>
            <p>
              Open a book from your library to start reading. Your progress will be here when you
              return.
            </p>
            <button className="reader-button" onClick={showLibrary}>
              Choose a book
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        {!!data.current.length && (
          <button className="reader-card-footer" onClick={showLibrary}>
            <Library size={16} />
            View your library
            <ArrowRight size={16} />
          </button>
        )}
      </section>
      <div className="reader-reading-aside">
        <section className="reader-card" aria-labelledby="finished-heading">
          <header className="reader-card-heading">
            <div className="reader-section-title">
              <span className="reader-icon reader-icon-gold">
                <CircleCheck size={20} />
              </span>
              <div>
                <h2 id="finished-heading">Last chapter closed</h2>
                <p>Your most recent finish.</p>
              </div>
            </div>
          </header>
          <div className="reader-card-body">
            {data.last ? (
              <>
                <BookCard book={data.last.book} openBook={openBook} />
                <p className="reader-finish-date">
                  {data.last.finishedAt
                    ? `Finished ${new Date(data.last.finishedAt).toLocaleDateString()}`
                    : "Finish date not recorded"}
                </p>
              </>
            ) : (
              <p className="reader-muted">Your next finished book deserves a spot here.</p>
            )}
          </div>
        </section>
        <section className="reader-card" aria-labelledby="next-heading">
          <header className="reader-card-heading">
            <div className="reader-section-title">
              <span className="reader-icon">
                <Bookmark size={20} />
              </span>
              <div>
                <h2 id="next-heading">Waiting in the wings</h2>
                <p>Recently saved for later.</p>
              </div>
            </div>
          </header>
          <div className="reader-card-body">
            {data.next.length ? (
              <ul className="reader-next-list">
                {data.next.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} openBook={openBook} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="reader-muted">
                Found something you want to read? Save it from Search and keep it close.
              </p>
            )}
          </div>
          <a href="/search" className="reader-card-footer">
            Discover a book
            <ArrowRight size={16} />
          </a>
        </section>
      </div>
    </section>
  );
}

function BookCard({ book, openBook }: { book: Book; openBook: (book: Book) => void }) {
  return (
    <button
      className="reader-book-row"
      onClick={() => openBook(book)}
      aria-label={`Open ${book.title}`}
    >
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" loading="lazy" />
      ) : (
        <span className="reader-cover-placeholder" aria-hidden="true">
          <BookOpen size={25} strokeWidth={1} />
        </span>
      )}
      <span className="reader-book-copy">
        <span className="reader-book-title">{book.title}</span>
        <span className="reader-muted">{book.authors.join(", ") || "Unknown author"}</span>
        {book.halfStars !== null && (
          <span className="reader-book-rating" aria-label={`Rated ${book.halfStars / 2} out of 5`}>
            ★ {book.halfStars / 2} / 5
          </span>
        )}
      </span>
    </button>
  );
}

function positionLabel(position: number, unit: string) {
  if (unit === "second") {
    const hours = Math.floor(position / 3600);
    const minutes = Math.floor((position % 3600) / 60);
    return `${hours ? `${hours}h ` : ""}${minutes}m`;
  }
  return unit === "percent" ? `${position}%` : `${position} pages`;
}
