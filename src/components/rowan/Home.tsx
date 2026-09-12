import { BookCover } from "./BookCover";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Bookmark, CircleCheck, Library } from "lucide-react";
import { rowanHome } from "@/lib/rowan-fns";
import { ReadingProgressBar } from "./ReadingProgressBar";

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
              return (
                <li key={item.book.id}>
                  <BookCard book={item.book} openBook={openBook} />
                  {item.timerStartedAt && (
                    <p className="text-sm text-primary">
                      Reading timer is running
                    </p>
                  )}
                  <ReadingProgressBar progress={item} />
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
      <BookCover
        title={book.title}
        authors={book.authors}
        src={book.coverUrl}
        className="rowan-cover-small"
      />
      <span className="reader-book-copy">
        <span className="reader-book-title">{book.title}</span>
        <span className="reader-muted">{book.authors.join(", ") || "Unknown author"}</span>
      </span>
    </button>
  );
}
