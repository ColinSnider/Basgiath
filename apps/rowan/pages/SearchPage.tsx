import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanSearch, rowanStatus } from "@/lib/rowan-fns";
import { ManualBook } from "@/components/rowan/ManualBook";
import { control, useReader, useReadingCommands } from "../components/reader";
export function SearchPage() {
  const { sessionId } = useReader();
  const { run, busy, feedback } = useReadingCommands();
  const { data: configuration } = useQuery({
    queryKey: ["rowan-configuration"],
    queryFn: () => rowanStatus(),
    staleTime: Infinity,
  });
  const googleBooksEnabled = configuration?.googleBooksEnabled ?? false;
  const [catalogSource, setCatalogSource] = useState<"openlibrary" | "googlebooks">("openlibrary");
  const [searchText, setSearchText] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [includeExtras, setIncludeExtras] = useState(false);
  const catalog = useQuery({
    queryKey: ["rowan", sessionId, "search", catalogQuery, catalogSource, includeExtras],
    queryFn: () =>
      rowanSearch({
        data: { sessionId, query: catalogQuery, source: catalogSource, includeExtras },
      }),
    enabled: !!catalogQuery,
    retry: false,
  });

  return (
    <>
      {feedback}{" "}
      <section
        id="find-books"
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
        aria-label="Find a book"
      >
        <h2 className="font-display text-2xl">Your next good book</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeExtras}
            onChange={(event) => setIncludeExtras(event.target.checked)}
          />
          Include companion books, collections and activities
        </label>
        {googleBooksEnabled && (
          <label className="text-sm">
            Search source{" "}
            <select
              className={control}
              value={catalogSource}
              onChange={(event) => setCatalogSource(event.target.value as typeof catalogSource)}
            >
              <option value="googlebooks">Google Books</option>
              <option value="openlibrary">Open Library</option>
            </select>
          </label>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const query = searchText.trim();
            if (query === catalogQuery) void catalog.refetch();
            else setCatalogQuery(query);
          }}
        >
          <input
            aria-label="Search the catalog"
            placeholder="Search books or authors"
            maxLength={200}
            className={`${control} min-w-0 flex-1`}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <button className={control} disabled={!searchText.trim() || catalog.isFetching}>
            Search
          </button>
        </form>
        {catalog.isFetching && (
          <p role="status">
            Searching {catalogSource === "googlebooks" ? "Google Books" : "Open Library"}…
          </p>
        )}
        {catalog.isError && (
          <div role="alert" className="flex items-center gap-3">
            <p>
              {catalog.error instanceof Error
                ? catalog.error.message
                : "Catalog search is unavailable."}
            </p>
            <button
              type="button"
              className={control}
              disabled={catalog.isFetching}
              onClick={() => void catalog.refetch()}
            >
              Retry search
            </button>
          </div>
        )}
        {catalog.data && !catalog.data.length && (
          <p>No matching books. Try another title or author.</p>
        )}
        {!!catalog.data?.length && (
          <ul className="divide-y divide-border">
            {catalog.data.map((book) => (
              <li
                key={`${book.ref.provider}:${book.ref.externalId}`}
                className="flex items-center gap-3 py-3"
              >
                {book.coverUrl && (
                  <img
                    src={book.coverUrl}
                    alt=""
                    loading="lazy"
                    className="h-20 w-14 object-contain"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{book.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {book.authors.join(", ") || "Unknown author"}
                  </p>
                  {book.ref.provider === "googlebooks" && (
                    <a
                      className="text-xs underline"
                      href={`https://books.google.com/books?id=${encodeURIComponent(book.ref.externalId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View edition on Google Books
                    </a>
                  )}
                </div>
                <button
                  className={control}
                  disabled={busy}
                  onClick={() => run({ type: "save", key: crypto.randomUUID(), ref: book.ref })}
                >
                  Save book
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ManualBook run={run} busy={busy} />
    </>
  );
}
