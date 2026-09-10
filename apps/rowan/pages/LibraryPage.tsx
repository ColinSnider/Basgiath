import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanLibrary, rowanShelves, type RowanCommand } from "@/lib/rowan-fns";
import { control, statuses, useReader, useReadingCommands } from "../components/reader";
export function LibraryPage() {
  const { sessionId, openBook } = useReader();
  const { run, busy, feedback } = useReadingCommands();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [shelfId, setShelfId] = useState("");
  const [shelfName, setShelfName] = useState("");
  const shelves = useQuery({
    queryKey: ["rowan", sessionId, "shelves"],
    queryFn: () => rowanShelves({ data: { sessionId } }),
    retry: false,
  });
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"grid" | "list" | "bookshelf">("grid");
  const [sort, setSort] = useState<"newest" | "oldest" | "title" | "rating">("newest");
  const library = useQuery({
    queryKey: ["rowan", sessionId, "library", query, status, offset, favoritesOnly, shelfId, sort],
    queryFn: () =>
      rowanLibrary({
        data: {
          sessionId,
          query,
          status,
          offset,
          favoritesOnly,
          shelfId: shelfId || undefined,
          sort,
        },
      }),
    retry: false,
  });

  return (
    <>
      {feedback}{" "}
      <section className="rowan-library space-y-4" aria-labelledby="library-heading">
        <div className="space-y-3">
          <h2 className="font-display text-2xl">Your shelves</h2>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run({ type: "shelfCreate", key: crypto.randomUUID(), name: shelfName.trim() });
            }}
          >
            <input
              className={control}
              aria-label="New shelf name"
              placeholder="A shelf for your books"
              maxLength={120}
              required
              value={shelfName}
              onChange={(e) => setShelfName(e.target.value)}
            />
            <button className={control} disabled={busy || !shelfName.trim()}>
              Create shelf
            </button>
          </form>
          {shelves.isPending && <p role="status">Loading shelves…</p>}
          {shelves.isError && (
            <p role="alert">
              Shelves could not load.{" "}
              <button className={control} onClick={() => void shelves.refetch()}>
                Retry
              </button>
            </p>
          )}
          {shelves.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Make a shelf for a mood, a season, or a collection.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={control}
              aria-pressed={!shelfId}
              onClick={() => {
                setShelfId("");
                setOffset(0);
              }}
            >
              All shelves
            </button>
            {shelves.data?.map((shelf) => (
              <button
                className={control}
                key={shelf.id}
                aria-pressed={shelfId === shelf.id}
                onClick={() => {
                  setShelfId(shelf.id);
                  setOffset(0);
                }}
              >
                {shelf.name}
              </button>
            ))}
          </div>
          {shelves.data
            ?.filter((shelf) => shelf.id === shelfId)
            .map((shelf) => (
              <RenameShelf
                key={`${shelf.id}:${shelf.version}`}
                shelf={shelf}
                busy={busy}
                run={run}
              />
            ))}
        </div>
        <h2 id="library-heading" className="font-display text-3xl">
          Your library
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${control} flex-1`}
            aria-label="Filter your library"
            placeholder="Find a saved book"
            maxLength={200}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
          <select
            aria-label="Reading status"
            className={control}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            className={control}
            aria-pressed={favoritesOnly}
            onClick={() => {
              setFavoritesOnly(!favoritesOnly);
              setOffset(0);
            }}
          >
            Favorites
          </button>
          <select
            aria-label="Sort library"
            className={control}
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setOffset(0);
            }}
          >
            <option value="newest">Recently added</option>
            <option value="oldest">Oldest added</option>
            <option value="title">Title A–Z</option>
            <option value="rating">Highest rated</option>
          </select>
          {(["grid", "list", "bookshelf"] as const).map((mode) => (
            <button
              key={mode}
              className={control}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode === "grid" ? "Grid" : mode === "list" ? "List" : "Bookshelf"}
            </button>
          ))}
        </div>
        {library.isPending && <p role="status">Loading your books…</p>}
        {library.isError && (
          <p role="alert">
            Your library could not load.{" "}
            <button className={control} onClick={() => void library.refetch()}>
              Retry
            </button>
          </p>
        )}
        {library.data && !library.data.items.length && (
          <p className="py-8 text-muted-foreground">
            {query || status !== "all" || favoritesOnly || shelfId
              ? "No books match these filters."
              : "Your Rowan library starts here. Find your first book on the Search page."}
          </p>
        )}
        <ul
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-4 lg:grid-cols-4"
              : view === "bookshelf"
                ? "grid grid-cols-3 gap-x-3 gap-y-6 md:grid-cols-6"
                : "space-y-3"
          }
        >
          {library.data?.items.map((book) => (
            <li
              key={book.id}
              className={view === "bookshelf" ? "border-b-8 border-primary/30 pb-2" : undefined}
            >
              <button
                className={`w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary ${view === "list" ? "flex items-center gap-4" : "h-full"}`}
                onClick={() => openBook(book)}
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    loading="lazy"
                    className={`rounded object-contain ${view !== "list" ? "h-40 w-full mb-3" : "h-16 w-12"}`}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className={`rounded bg-muted grid place-items-center font-display text-primary ${view === "grid" ? "h-40 mb-3" : "h-16 w-12 shrink-0"}`}
                  >
                    R
                  </div>
                )}
                <div>
                  <h3 className="font-medium">
                    {book.title}
                    {book.isFavorite && <span aria-label="Favorite"> ♥</span>}
                  </h3>
                  {book.halfStars !== null && (
                    <p
                      className="text-sm"
                      aria-label={`Your rating: ${book.halfStars / 2} out of 5 stars`}
                    >
                      {book.halfStars / 2} / 5 ★
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {book.authors.join(", ") || "Unknown author"}
                  </p>
                  <p className="mt-2 text-xs text-primary">
                    {statuses[book.status as keyof typeof statuses]}
                  </p>
                  {book.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {book.tags.slice(0, 3).map((tag) => (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            className={control}
            disabled={!offset || library.isFetching}
            onClick={() => {
              setOffset(Math.max(0, offset - 24));
            }}
          >
            Previous
          </button>
          <button
            className={control}
            disabled={library.data?.nextOffset == null || library.isFetching}
            onClick={() => {
              setOffset(library.data!.nextOffset!);
            }}
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}
function RenameShelf({
  shelf,
  busy,
  run,
}: {
  shelf: Awaited<ReturnType<typeof rowanShelves>>[number];
  busy: boolean;
  run: (command: RowanCommand) => void;
}) {
  const [name, setName] = useState(shelf.name);
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run({
          type: "shelfRename",
          key: crypto.randomUUID(),
          shelfId: shelf.id,
          expectedVersion: shelf.version,
          name: name.trim(),
        });
      }}
    >
      <input
        className={control}
        aria-label="Rename selected shelf"
        maxLength={120}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className={control} disabled={busy || !name.trim() || name.trim() === shelf.name}>
        Rename shelf
      </button>
    </form>
  );
}
