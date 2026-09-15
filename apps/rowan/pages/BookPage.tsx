import { ReadingOrganization } from "@/components/rowan/ReadingOrganization";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { rowanBook, rowanShelves } from "@/lib/rowan-fns";
import { ReadingPanel } from "@/components/rowan/ReadingPanel";
import { useReader, useReadingCommands } from "../components/reader";

export function BookPage() {
  const { bookId } = useParams({ from: "/books/$bookId" });
  const { sessionId, goLibrary, openBook } = useReader();
  const { run, busy, feedback } = useReadingCommands();
  const book = useQuery({
    queryKey: ["rowan", sessionId, "book", bookId],
    queryFn: () => rowanBook({ data: { sessionId, userBookId: bookId } }),
    retry: false,
  });
  const shelves = useQuery({
    queryKey: ["rowan", sessionId, "shelves"],
    queryFn: () => rowanShelves({ data: { sessionId } }),
    retry: false,
  });
  if (book.isPending) return <p role="status">Loading your book…</p>;
  if (book.isError)
    return (
      <p role="alert">
        This book could not load. <button onClick={() => void book.refetch()}>Try again</button>
      </p>
    );
  if (!book.data) return <p>This book is no longer in your library.</p>;
  return (
    <>
      {feedback}
      {shelves.isError && (
        <p role="alert">
          Shelves could not load. <button onClick={() => void shelves.refetch()}>Retry</button>
        </p>
      )}
      <ReadingPanel
        key={bookId}
        book={book.data}
        sessionId={sessionId}
        shelves={shelves.data ?? []}
        busy={busy}
        run={run}
        close={goLibrary}
        organization={
          <ReadingOrganization sessionId={sessionId} bookId={bookId} openBook={openBook} />
        }
      />
    </>
  );
}
