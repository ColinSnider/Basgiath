import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanJournal } from "@/lib/rowan-fns";

type Book = Awaited<ReturnType<typeof rowanJournal>>["items"][number]["book"];
export function Journal({
  sessionId,
  openBook,
}: {
  sessionId: string;
  openBook: (book: Book) => void;
}) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["rowan", sessionId, "journal", search, offset],
    queryFn: () => rowanJournal({ data: { sessionId, query: search, offset } }),
  });
  const button = "rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
  return (
    <section id="journal" className="space-y-4">
      <h2 className="font-display text-3xl">Your margins</h2>
      <p className="text-muted-foreground">Thoughts and passages from across your library.</p>
      <input
        aria-label="Search margins"
        placeholder="Find a thought or book"
        maxLength={200}
        className={`${button} w-full bg-background`}
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setOffset(0);
        }}
      />
      {query.isPending && <p role="status">Loading margins…</p>}
      {query.isError && (
        <p role="alert">
          Margins could not load. <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {query.data?.items.length === 0 && <p>No margins here yet. Open a book to save a thought.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {query.data?.items.map((margin) => (
          <article
            key={margin.id}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
          >
            <button
              className="font-display text-xl underline"
              onClick={() => openBook(margin.book)}
            >
              {margin.book.title}
            </button>
            <p className="whitespace-pre-wrap break-words">{margin.body}</p>
            <p className="text-xs text-muted-foreground">
              {margin.locator && `${margin.locator} · `}
              {new Date(margin.updatedAt).toLocaleDateString()}
            </p>
          </article>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          className={button}
          disabled={!offset || query.isFetching}
          onClick={() => setOffset(Math.max(0, offset - 24))}
        >
          Previous
        </button>
        <button
          className={button}
          disabled={query.data?.nextOffset == null || query.isFetching}
          onClick={() => setOffset(query.data!.nextOffset!)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
