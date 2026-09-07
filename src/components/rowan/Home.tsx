import { useQuery } from "@tanstack/react-query";
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
  return (
    <section aria-labelledby="reading-overview" className="space-y-4">
      <div>
        <h2 id="reading-overview" className="font-display text-3xl">
          Your reading life
        </h2>
        <p className="text-sm text-muted-foreground">
          Where you’ve been. Where you are. What’s next.
        </p>
      </div>
      {home.isPending && <p role="status">Loading your reading overview…</p>}
      {home.isError && (
        <p role="alert">
          Your overview could not load.{" "}
          <button className="underline" onClick={() => void home.refetch()}>
            Try again
          </button>
        </p>
      )}
      {home.data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-display text-xl">Last</h3>
            {home.data.last ? (
              <>
                <BookCard book={home.data.last.book} openBook={openBook} />
                <p className="text-xs text-muted-foreground">
                  {home.data.last.finishedAt
                    ? `Finished ${new Date(home.data.last.finishedAt).toLocaleDateString()}`
                    : "Finish date not recorded"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your most recently finished book will appear here.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-display text-xl">Current</h3>
            {!home.data.current.length && (
              <p className="text-sm text-muted-foreground">
                Ready for a new chapter? Open a saved book to start reading.
              </p>
            )}
            <ul className="space-y-4">
              {home.data.current.map((item) => (
                <li key={item.book.id} className="space-y-2">
                  <BookCard book={item.book} openBook={openBook} />
                  <p className="text-sm text-muted-foreground">
                    {item.state === "paused" ? "Paused · " : ""}
                    {positionLabel(item.position, item.unit)}
                    {item.total === null
                      ? " · Length unknown"
                      : ` of ${positionLabel(item.total, item.unit)}`}
                  </p>
                  {item.total !== null && (
                    <progress
                      className="w-full"
                      value={item.position}
                      max={item.total}
                      aria-label={`Progress for ${item.book.title}`}
                    />
                  )}
                </li>
              ))}
            </ul>
            <button className="text-sm underline" onClick={showLibrary}>
              {home.data.hasMoreCurrent
                ? "See all your books and current reads"
                : "Open your library"}
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-display text-xl">Next</h3>
            <p className="text-xs text-muted-foreground">Recently saved for later</p>
            {!home.data.next.length && (
              <p className="text-sm text-muted-foreground">
                Save a book from the search below to keep it here.
              </p>
            )}
            <ul className="space-y-3">
              {home.data.next.map((book) => (
                <li key={book.id}>
                  <BookCard book={book} openBook={openBook} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function BookCard({ book, openBook }: { book: Book; openBook: (book: Book) => void }) {
  return (
    <button
      className="flex w-full gap-3 rounded-lg p-1 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      onClick={() => openBook(book)}
      aria-label={`Open ${book.title}`}
    >
      {book.coverUrl ? (
        <img
          className="h-20 w-14 shrink-0 rounded object-contain"
          src={book.coverUrl}
          alt=""
          loading="lazy"
        />
      ) : (
        <span
          className="grid h-20 w-14 shrink-0 place-items-center rounded bg-muted font-display text-2xl"
          aria-hidden="true"
        >
          R
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-medium">{book.title}</span>
        <span className="block text-xs text-muted-foreground">
          {book.authors.join(", ") || "Unknown author"}
        </span>
        <span className="mt-2 block text-xs text-primary">Open book</span>
      </span>
    </button>
  );
}

function positionLabel(position: number, unit: string) {
  if (unit === "second") {
    const hours = Math.floor(position / 3600);
    const minutes = Math.floor((position % 3600) / 60);
    const seconds = position % 60;
    return `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
  }
  return unit === "percent" ? `${position}%` : `${position} pages`;
}
