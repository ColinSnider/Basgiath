import { BookSpine } from "@/components/rowan/BookSpine";
import { BookCover } from "@/components/rowan/BookCover";
import { ReadingOrganization } from "@/components/rowan/ReadingOrganization";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FolderHeart, LibraryBig, Plus } from "lucide-react";
import { rowanLibrary, rowanShelves, type RowanCommand } from "@/lib/rowan-fns";
import { ReadingProgressBar } from "@/components/rowan/ReadingProgressBar";
import { control, statuses, useReader, useReadingCommands } from "../components/reader";

type LibraryBook = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];

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
  const [view, setView] = useState<"grid" | "list" | "bookshelf">("bookshelf");
  const [sort, setSort] = useState<"newest" | "oldest" | "title" | "rating">("newest");
  const [section, setSection] = useState<"library" | "shelves" | "series">("library");
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
      {feedback}
      <div className="reader-library-switch" role="tablist" aria-label="Library sections">
        <button
          role="tab"
          aria-selected={section === "library"}
          className={section === "library" ? "is-selected" : ""}
          onClick={() => {
            setSection("library");
            setView("bookshelf");
          }}
        >
          <LibraryBig size={18} /> Shelves <span>{library.data?.items.length ?? "—"}</span>
        </button>
        <button
          role="tab"
          aria-selected={section === "shelves"}
          className={section === "shelves" ? "is-selected" : ""}
          onClick={() => setSection("shelves")}
        >
          <FolderHeart size={18} /> Collections <span>{shelves.data?.length ?? "—"}</span>
        </button>
        <button
          role="tab"
          aria-selected={section === "series"}
          className={section === "series" ? "is-selected" : ""}
          onClick={() => setSection("series")}
        >
          Series & queue
        </button>
      </div>
      {section === "series" && <ReadingOrganization sessionId={sessionId} openBook={openBook} />}
      {section === "shelves" && (
        <ShelvesView
          shelves={shelves.data ?? []}
          loading={shelves.isPending}
          error={shelves.isError}
          shelfName={shelfName}
          setShelfName={setShelfName}
          busy={busy}
          run={run}
          onRetry={() => void shelves.refetch()}
          onOpen={(id) => {
            setShelfId(id);
            setSection("library");
            setOffset(0);
          }}
          onOpenBook={openBook}
        />
      )}
      <section
        className={`rowan-library space-y-4 ${section !== "library" ? "hidden" : ""}`}
        aria-labelledby="library-heading"
        hidden={section !== "library"}
      >
        <div className="space-y-3" hidden>
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
              ? "reader-library-grid"
              : view === "bookshelf"
                ? "reader-bookshelf-list"
                : "space-y-3"
          }
        >
          {library.data?.items.map((book) => (
            <li
              key={book.id}
              className={
                view === "bookshelf"
                  ? "reader-bookshelf-item"
                  : `reader-library-tile reader-library-tile-${view}`
              }
            >
              <button
                className={
                  view === "bookshelf"
                    ? "reader-book-spine-button"
                    : `w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary ${view === "list" ? "flex items-center gap-4" : "h-full"}`
                }
                aria-label={`Open ${book.title}`}
                title={`${book.title} — ${book.authors.join(", ")}`}
                onClick={() => openBook(book)}
              >
                {view === "bookshelf" ? (
                  <BookSpine book={book} />
                ) : (
                  <BookCover
                    title={book.title}
                    authors={book.authors}
                    src={book.coverUrl}
                    className={view === "grid" ? "rowan-cover-grid" : "rowan-cover-small"}
                  />
                )}
                <div className={view === "bookshelf" ? "sr-only" : "reader-tile-copy"}>
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
              {view !== "bookshelf" && <ReadingProgressBar progress={book.progress} />}
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

function ShelvesView({
  shelves,
  loading,
  error,
  shelfName,
  setShelfName,
  busy,
  run,
  onRetry,
  onOpen,
  onOpenBook,
}: {
  shelves: Array<{
    id: string;
    name: string;
    version: number;
    itemCount: number;
    books: LibraryBook[];
  }>;
  loading: boolean;
  error: boolean;
  shelfName: string;
  setShelfName: (name: string) => void;
  busy: boolean;
  run: (command: RowanCommand) => void;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onOpenBook: (book: LibraryBook) => void;
}) {
  return (
    <section className="reader-shelves-view space-y-5" aria-labelledby="shelves-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="reader-eyebrow">Organize by feeling</p>
          <h2 id="shelves-heading" className="font-display text-3xl">
            Your shelves
          </h2>
          <p className="reader-muted">
            Keep your collections close and your next read easy to find.
          </p>
        </div>
        <form
          className="reader-shelf-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (shelfName.trim())
              run({ type: "shelfCreate", key: crypto.randomUUID(), name: shelfName.trim() });
          }}
        >
          <input
            aria-label="New shelf name"
            placeholder="New shelf name"
            value={shelfName}
            maxLength={120}
            required
            onChange={(event) => setShelfName(event.target.value)}
          />
          <button className="reader-button" disabled={busy || !shelfName.trim()}>
            <Plus size={16} /> Create shelf
          </button>
        </form>
      </div>
      {loading && (
        <p role="status" className="reader-state">
          Loading your shelves…
        </p>
      )}
      {error && (
        <p role="alert" className="reader-state">
          Shelves could not load. <button onClick={onRetry}>Try again</button>
        </p>
      )}
      {!loading && !error && shelves.length === 0 && (
        <div className="reader-empty reader-card">
          <FolderHeart size={34} strokeWidth={1.2} />
          <h3>Your shelves are waiting</h3>
          <p>
            Create one for a mood, a series, or the books you want to carry into the next season.
          </p>
        </div>
      )}
      {!!shelves.length && (
        <div className="reader-shelf-grid">
          {shelves.map((shelf) => (
            <article className="reader-shelf-card" key={shelf.id}>
              <button
                className="reader-shelf-open"
                onClick={() => onOpen(shelf.id)}
                aria-label={`Open ${shelf.name}`}
              >
                <span className="reader-shelf-mark">
                  <FolderHeart size={28} />
                </span>
                <span className="reader-shelf-name">{shelf.name}</span>
                <span className="reader-muted">
                  {shelf.itemCount} {shelf.itemCount === 1 ? "book" : "books"}
                </span>
                <span className="reader-shelf-arrow">
                  <ArrowRight size={18} />
                </span>
              </button>
              <div className="reader-shelf-row" aria-label={`${shelf.name} book positions`}>
                {shelf.books.length ? (
                  shelf.books.map((book) => (
                    <button
                      key={book.id}
                      className="reader-book-spine-button"
                      onClick={() => onOpenBook(book)}
                      aria-label={`Open ${book.title}`}
                    >
                      <BookSpine book={book} />
                    </button>
                  ))
                ) : (
                  <span className="reader-muted">No books placed here yet.</span>
                )}
              </div>
              <RenameShelf shelf={shelf} busy={busy} run={run} />
            </article>
          ))}
        </div>
      )}
    </section>
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
