import { useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Library,
  Heart,
  BookCheck,
  X,
  Plus,
  Layers,
} from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { librarySearch } from "../components/library-search";
import { useQuery } from "@tanstack/react-query";
import { rowanLibrary, rowanShelves, rowanOrganization, rowanLibraryFacets } from "@/lib/rowan-fns";
import { ShelfBooks } from "@/components/rowan/PhysicalShelf";
import { BookCover } from "@/components/rowan/BookCover";
import { ReadingOrganization } from "@/components/rowan/ReadingOrganization";
import { ReadingProgressBar } from "@/components/rowan/ReadingProgressBar";
import { control, statuses, useReader, useReadingCommands } from "../components/reader";

type Book = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];
type Shelf = Awaited<ReturnType<typeof rowanShelves>>[number];
function AddShelfBook({
  sessionId,
  shelf,
  busy,
  run,
}: {
  sessionId: string;
  shelf: Shelf;
  busy: boolean;
  run: ReturnType<typeof useReadingCommands>["run"];
}) {
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const candidates = useQuery({
    queryKey: ["rowan", sessionId, "shelf-candidates", term, offset],
    enabled: !!term.trim(),
    queryFn: () =>
      rowanLibrary({ data: { sessionId, query: term, offset, status: "all", sort: "title" } }),
  });
  return (
    <div className="space-y-2 py-3">
      <label className="block">
        Add books from your library
        <input
          className={control}
          value={term}
          maxLength={200}
          placeholder="Search title or author…"
          onChange={(e) => {
            setTerm(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      {candidates.isFetching && <p role="status">Finding books…</p>}
      {candidates.isError && (
        <p role="alert">
          Books could not load. <button onClick={() => void candidates.refetch()}>Retry</button>
        </p>
      )}
      {candidates.data?.items.map((book) => (
        <div key={book.id} className="reader-shelf-toolbar">
          <span>
            {book.title} · {book.authors.join(", ")}
          </span>
          <button
            className={control}
            disabled={busy || shelf.bookIds.includes(book.id)}
            onClick={() =>
              run({
                type: "shelfItem",
                key: crypto.randomUUID(),
                shelfId: shelf.id,
                userBookId: book.id,
                expectedVersion: shelf.version,
                present: true,
              })
            }
          >
            {shelf.bookIds.includes(book.id) ? "On shelf" : "Add"}
          </button>
        </div>
      ))}
      {candidates.data?.total === 0 && <p>No matching books.</p>}
      {!!term && (
        <div className="reader-shelf-toolbar">
          <button
            className={control}
            disabled={!offset || candidates.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 24))}
          >
            Previous
          </button>
          <button
            className={control}
            disabled={!candidates.data?.nextOffset || candidates.isFetching}
            onClick={() => setOffset(candidates.data!.nextOffset!)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
export function LibraryPage() {
  const { sessionId, openBook } = useReader();
  const { run, busy, feedback } = useReadingCommands();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const browsing = librarySearch.parse(useSearch({ strict: false }));
  const navigate = useNavigate();
  const {
    view,
    section,
    query,
    status,
    shelf: selectedShelf,
    format,
    author,
    year,
    favorite,
    read,
    sort,
    collection,
    collectionId,
    page,
  } = browsing;
  const inCollections = section !== "books";
  const collectionType = section === "series" ? "" : collection;
  const filterCount = [
    status !== "all",
    !!selectedShelf,
    format !== "all",
    !!author,
    !!year,
    favorite,
    read,
    sort !== "shelf",
  ].filter(Boolean).length;
  const update = (patch: Partial<typeof browsing>) =>
    void navigate({
      to: "/library",
      search: {
        ...browsing,
        page: Object.keys(patch).some((key) => key !== "view" && key !== "page") ? 1 : page,
        ...patch,
      },
      replace: patch.page === undefined,
      resetScroll: patch.page !== undefined,
    });
  const setView = (view: typeof browsing.view) => update({ view });
  const setQuery = (query: string) => update({ query });
  const setStatus = (status: string) => update({ status });
  const setSelectedShelf = (shelf: string) => update({ shelf });
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const shelves = useQuery({
    queryKey: ["rowan", sessionId, "shelves"],
    queryFn: () => rowanShelves({ data: { sessionId } }),
  });
  const organization = useQuery({
    queryKey: ["rowan", sessionId, "organization"],
    queryFn: () => rowanOrganization({ data: { sessionId } }),
    enabled: inCollections,
  });
  const chooseCollection = (collection: typeof browsing.collection, collectionId = "") =>
    update({
      section: "collections",
      collection,
      collectionId,
      shelf: collection === "shelf" ? collectionId : "",
      query: "",
      status: "all",
      format: "all",
      author: "",
      year: "",
      favorite: false,
      read: false,
      sort: "shelf",
    });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const facets = useQuery({
    queryKey: ["rowan", sessionId, "library-facets", timeZone],
    queryFn: () => rowanLibraryFacets({ data: { sessionId, timeZone } }),
  });
  const library = useQuery({
    queryKey: [
      "rowan",
      sessionId,
      "library-page",
      page,
      query,
      status,
      selectedShelf,
      format,
      author,
      year,
      favorite,
      read,
      sort,
      inCollections,
      collectionType,
      collectionId,
      timeZone,
    ],
    queryFn: () =>
      rowanLibrary({
        data: {
          sessionId,
          offset: (page - 1) * 24,
          query,
          status,
          sort,
          favoritesOnly: favorite,
          read,
          format: format as "all" | "book" | "ebook" | "audiobook" | "unknown",
          author,
          year,
          timeZone,
          shelfId: selectedShelf && selectedShelf !== "unfiled" ? selectedShelf : undefined,
          unfiled: selectedShelf === "unfiled",
          collection: inCollections ? collectionType : "",
          collectionId: inCollections && collectionId ? collectionId : undefined,
        },
      }),
  });
  const total = library.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 24));
  useEffect(() => {
    if (library.data && page > pageCount)
      void navigate({
        to: "/library",
        search: { ...browsing, page: pageCount },
        replace: true,
        resetScroll: false,
      });
  }, [library.data, page, pageCount, navigate]);
  // The server applies all filters before pagination; views only arrange those results.
  const matches = (_book: Book) => true;
  const allBooks = library.data?.items ?? [];
  const bookById = new Map(allBooks.map((book) => [book.id, book]));
  const rank = new Map(allBooks.map((book, index) => [book.id, index]));
  const collectionName =
    collectionType === "shelf"
      ? shelves.data?.find((s) => s.id === collectionId)?.name
      : collectionType === "series"
        ? organization.data?.series.find((s) => s.id === collectionId)?.name
        : "Reading queue";
  const collectionBookIds =
    !inCollections || !collectionType
      ? null
      : collectionType === "shelf"
        ? (shelves.data?.find((s) => s.id === collectionId)?.bookIds ?? [])
        : collectionType === "queue"
          ? (organization.data?.queue.map((entry) => entry.userBookId) ?? [])
          : (organization.data?.members
              .filter((m) => m.seriesId === collectionId)
              .map((m) => m.userBookId) ?? []);
  const collectionBooks =
    collectionBookIds === null
      ? allBooks
      : collectionBookIds.flatMap((id) => {
          const book = bookById.get(id);
          return book ? [book] : [];
        });
  const authors = facets.data?.authors ?? [];
  const years = facets.data?.years ?? [];
  const ordered = (books: Book[]) =>
    sort === "shelf" ? books : [...books].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const unfiled = allBooks.filter((b) => !b.shelfIds.length);
  const groups = [
    ...(shelves.data ?? []).map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      shelf,
      books: shelf.bookIds.flatMap((id) => {
        const book = bookById.get(id);
        return book ? [book] : [];
      }),
    })),
    {
      id: "unfiled",
      name: shelves.data?.length ? "Unfiled books" : "Your books",
      shelf: undefined as Shelf | undefined,
      books: unfiled,
    },
  ].filter(
    (g) =>
      (!inCollections || collectionType !== "shelf" || g.id === collectionId) &&
      (!selectedShelf || selectedShelf === g.id) &&
      (g.books.length > 0 || g.id === selectedShelf || (inCollections && g.id === collectionId)) &&
      (g.id !== "unfiled" || g.books.length > 0 || !shelves.data?.length),
  );
  const listBooks = ordered(
    collectionBooks.filter(
      (b) =>
        matches(b) &&
        (!selectedShelf ||
          (selectedShelf === "unfiled" ? !b.shelfIds.length : b.shelfIds.includes(selectedShelf))),
    ),
  );
  return (
    <>
      {feedback}
      <nav className="reader-library-switch" aria-label="Library sections">
        <button
          className={!inCollections ? "is-selected" : ""}
          aria-pressed={section === "books"}
          onClick={() => update({ section: "books", shelf: "", collection: "", collectionId: "" })}
        >
          <Library size={18} className="inline mr-2" aria-hidden="true" />
          Library <span>{facets.data?.count ?? "…"} books</span>
        </button>
        <button
          className={inCollections ? "is-selected" : ""}
          aria-pressed={inCollections}
          onClick={() => chooseCollection("")}
        >
          <Layers size={18} className="inline mr-2" aria-hidden="true" />
          Collections
        </button>
      </nav>
      {inCollections && !collectionType ? (
        <section className="reader-card reader-card-body space-y-5">
          <header>
            <h2>Collections</h2>
            <p className="text-muted-foreground">
              Your shelves, series, and reading queue. Each groups the books already in your
              library.
            </p>
          </header>
          {(shelves.isPending || organization.isPending) && (
            <p role="status">Loading collections…</p>
          )}
          {(shelves.isError || organization.isError) && (
            <p role="alert">
              Collections could not load.{" "}
              <button
                onClick={() => {
                  void shelves.refetch();
                  void organization.refetch();
                }}
              >
                Retry
              </button>
            </p>
          )}
          <h3>Shelves</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {shelves.data?.map((shelf) => (
              <button
                key={shelf.id}
                className={`${control} text-left`}
                onClick={() => chooseCollection("shelf", shelf.id)}
              >
                <Library size={20} aria-hidden="true" />
                <strong className="block">{shelf.name}</strong>
                <span className="block text-sm text-muted-foreground">
                  {shelf.bookIds.length} books{shelf.description ? ` · ${shelf.description}` : ""}
                </span>
              </button>
            ))}
          </div>
          {!shelves.data?.length && !shelves.isPending && (
            <p>No shelves yet. Create a group for any books you want to keep together.</p>
          )}
          <form
            className="reader-shelf-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              run({ type: "shelfCreate", key: crypto.randomUUID(), name: name.trim() });
            }}
          >
            <input
              className={control}
              aria-label="New shelf name"
              placeholder="New shelf name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
            <button className={control} disabled={busy || !name.trim()}>
              <Plus size={16} aria-hidden="true" /> Create shelf
            </button>
          </form>
          <h3>Series</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {organization.data?.series.map((series) => (
              <button
                className={`${control} text-left`}
                key={series.id}
                onClick={() => chooseCollection("series", series.id)}
              >
                <Layers size={20} aria-hidden="true" />
                <strong className="block">{series.name}</strong>
                <span className="block text-sm text-muted-foreground">
                  {organization.data.members.filter((m) => m.seriesId === series.id).length} books ·
                  Series order
                </span>
              </button>
            ))}
          </div>
          <details>
            <summary>Create or manage series</summary>
            <ReadingOrganization sessionId={sessionId} openBook={openBook} mode="series" />
          </details>
          <h3>Reading queue</h3>
          <button className={`${control} text-left`} onClick={() => chooseCollection("queue")}>
            <List size={20} aria-hidden="true" />
            <strong className="block">Up next</strong>
            <span className="block text-sm text-muted-foreground">
              {organization.data?.queue.length ?? 0} books · Your reading priorities
            </span>
          </button>
        </section>
      ) : (
        <section className="reader-shelf-library">
          {inCollections && (
            <header className="space-y-3">
              <button className={control} onClick={() => chooseCollection("")}>
                ← All collections
              </button>
              <h2>{collectionName ?? "Collection unavailable"}</h2>
              <p className="text-sm text-muted-foreground">
                {collectionType === "series"
                  ? "Books in series order"
                  : collectionType === "queue"
                    ? "Your next reads, in priority order"
                    : "Your personal shelf"}
              </p>
            </header>
          )}
          <div className="reader-library-searchbar">
            <label className="reader-library-search">
              <Search size={18} aria-hidden="true" />
              <input
                className={control}
                aria-label="Find a book"
                placeholder="Find a book or author…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className={`${control} reader-filter-trigger`}
              aria-expanded={filtersOpen}
              aria-controls="library-filter-panel"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              Filters{filterCount > 0 && <span className="reader-count">{filterCount}</span>}
            </button>
          </div>
          {filtersOpen && (
            <div id="library-filter-panel" className="reader-filter-panel">
              <div className="reader-shelf-toolbar">
                <select
                  className={control}
                  aria-label="Sort books"
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value as typeof sort })}
                >
                  {Object.entries({
                    shelf: inCollections ? "Collection order" : "Shelf order / title",
                    title: "Title A–Z",
                    author: "Author A–Z",
                    newest: "Recently added",
                    oldest: "Oldest added",
                    finished: "Recently finished",
                    pages: "Longest books",
                  }).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className={control}
                  aria-label="Format"
                  value={format}
                  onChange={(e) => update({ format: e.target.value })}
                >
                  {Object.entries({
                    all: "All formats",
                    book: "Print",
                    ebook: "Ebook",
                    audiobook: "Audiobook",
                    unknown: "Unspecified",
                  }).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className={control}
                  aria-label="Author"
                  value={author}
                  onChange={(e) => update({ author: e.target.value })}
                >
                  <option value="">All authors</option>
                  {authors.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <select
                  className={control}
                  aria-label="Completion year"
                  value={year}
                  onChange={(e) => update({ year: e.target.value })}
                >
                  <option value="">All completion years</option>
                  {years.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <button
                  className={control}
                  aria-pressed={favorite}
                  onClick={() => update({ favorite: !favorite })}
                >
                  <Heart size={16} aria-hidden="true" />
                  Favorites
                </button>
                <button
                  className={control}
                  aria-pressed={read}
                  onClick={() => update({ read: !read })}
                >
                  <BookCheck size={16} aria-hidden="true" />
                  Previously read
                </button>
                <button
                  className={control}
                  onClick={() =>
                    update({
                      query: "",
                      status: "all",
                      shelf: "",
                      format: "all",
                      author: "",
                      year: "",
                      favorite: false,
                      read: false,
                    })
                  }
                >
                  <X size={16} aria-hidden="true" />
                  Clear filters
                </button>
              </div>
              <div className="reader-shelf-toolbar">
                <select
                  className={control}
                  aria-label="Reading status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {Object.entries(statuses).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {!inCollections && (
                  <select
                    className={control}
                    aria-label="Shelf"
                    value={selectedShelf}
                    onChange={(e) => setSelectedShelf(e.target.value)}
                  >
                    <option value="">All shelves</option>
                    {shelves.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="unfiled">Unfiled books</option>
                  </select>
                )}
              </div>
            </div>
          )}
          <p role="status" className="text-sm text-muted-foreground">
            {total
              ? `${(page - 1) * 24 + 1}–${Math.min(page * 24, total)} of ${total} books`
              : "No matching books"}
            {filterCount ? " · Filters applied" : ""}
          </p>
          <div className="reader-shelf-toolbar">
            <div
              className="reader-shelf-view-switch reader-view-slider"
              style={
                {
                  "--view-index": view === "grid" ? 0 : view === "shelves" ? 1 : 2,
                } as React.CSSProperties
              }
              aria-label="Book view"
            >
              {(["grid", "shelves", "list"] as const).map((mode) => (
                <button
                  className={control}
                  aria-pressed={view === mode}
                  key={mode}
                  onClick={() => setView(mode)}
                >
                  {mode === "shelves" ? (
                    <Library size={16} aria-hidden="true" />
                  ) : mode === "grid" ? (
                    <LayoutGrid size={16} aria-hidden="true" />
                  ) : (
                    <List size={16} aria-hidden="true" />
                  )}
                  {mode === "shelves" ? "Shelves" : mode === "grid" ? "Grid" : "List"}
                </button>
              ))}
            </div>
            {!inCollections && (
              <details>
                <summary>
                  <Plus size={16} className="inline" aria-hidden="true" /> New shelf
                </summary>
                <form
                  className="reader-shelf-toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run({ type: "shelfCreate", key: crypto.randomUUID(), name: name.trim() });
                  }}
                >
                  <input
                    className={control}
                    aria-label="New shelf name"
                    value={name}
                    required
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button className={control} disabled={busy || !name.trim()}>
                    Create shelf
                  </button>
                </form>
              </details>
            )}
          </div>
          {(library.isPending ||
            shelves.isPending ||
            (inCollections && organization.isPending)) && (
            <p role="status">Placing your books on their shelves…</p>
          )}
          {(library.isError || shelves.isError || (inCollections && organization.isError)) && (
            <p role="alert">
              Your shelves could not load.{" "}
              <button
                onClick={() => {
                  void library.refetch();
                  void shelves.refetch();
                  if (inCollections) void organization.refetch();
                }}
              >
                Retry
              </button>
            </p>
          )}
          {!library.isPending && !library.isError && !shelves.isPending && !shelves.isError && (
            <>
              {view !== "shelves" ? (
                <ul className={view === "grid" ? "reader-library-grid" : "reader-library-list"}>
                  {listBooks.map((book) => (
                    <li className={`reader-library-tile reader-library-tile-${view}`} key={book.id}>
                      <button onClick={() => openBook(book)}>
                        <BookCover
                          title={book.title}
                          authors={book.authors}
                          src={book.coverUrl}
                          className={view === "grid" ? "rowan-cover-grid" : "rowan-cover-small"}
                        />
                        <span className="reader-tile-copy">
                          <h3>{book.title}</h3>
                          <small className="block">
                            {book.authors.join(", ") || "Unknown author"}
                          </small>
                          <span className="reader-list-status">{statuses[book.status]}</span>
                        </span>
                      </button>
                      <ReadingProgressBar progress={book.progress} />
                    </li>
                  ))}
                </ul>
              ) : inCollections && collectionType !== "shelf" ? (
                <article className="reader-physical-shelf">
                  <ShelfBooks books={listBooks} view="shelves" openBook={openBook} />
                </article>
              ) : null}
              {(view === "shelves" || (inCollections && collectionType === "shelf")) &&
                (!inCollections || collectionType === "shelf") &&
                groups.map((group) => (
                  <article className="reader-physical-shelf" key={group.id}>
                    <header>
                      <h2>{group.name}</h2>
                      <span>{group.shelf?.bookIds.length ?? group.books.length} books</span>
                    </header>
                    {group.shelf?.description && (
                      <p className="reader-muted">{group.shelf.description}</p>
                    )}
                    {group.shelf && (
                      <div className="reader-shelf-toolbar">
                        {(["up", "down"] as const).map((action) => (
                          <button
                            key={action}
                            className={control}
                            disabled={
                              busy ||
                              (action === "up"
                                ? shelves.data?.[0]?.id === group.id
                                : shelves.data?.at(-1)?.id === group.id)
                            }
                            aria-label={`Move ${group.name} ${action}`}
                            onClick={() =>
                              run({
                                type: "shelfManage",
                                key: crypto.randomUUID(),
                                shelfId: group.id,
                                expectedVersion: group.shelf!.version,
                                action,
                              })
                            }
                          >
                            {action === "up" ? "↑" : "↓"} Move shelf
                          </button>
                        ))}
                      </div>
                    )}
                    {view === "shelves" && (
                      <ShelfBooks
                        books={ordered(group.books.filter(matches))}
                        view={view}
                        openBook={openBook}
                      />
                    )}
                    <details className="reader-shelf-organize">
                      <summary>Organize this shelf</summary>
                      {group.shelf && (
                        <AddShelfBook
                          sessionId={sessionId}
                          shelf={group.shelf}
                          busy={busy}
                          run={run}
                        />
                      )}
                      {group.shelf && (
                        <form
                          className="reader-shelf-toolbar"
                          onSubmit={(e) => {
                            e.preventDefault();
                            run({
                              type: "shelfRename",
                              key: crypto.randomUUID(),
                              shelfId: group.id,
                              expectedVersion: group.shelf!.version,
                              name: String(new FormData(e.currentTarget).get("name")),
                              description: String(new FormData(e.currentTarget).get("description")),
                            });
                          }}
                        >
                          <input
                            className={control}
                            key={group.shelf.version}
                            name="name"
                            defaultValue={group.name}
                            required
                            maxLength={120}
                            aria-label={`Rename ${group.name}`}
                          />
                          <button className={control} disabled={busy}>
                            Save shelf
                          </button>
                          <textarea
                            className={control}
                            name="description"
                            defaultValue={group.shelf.description}
                            key={`description:${group.shelf.version}`}
                            maxLength={1000}
                            placeholder="What belongs on this shelf?"
                            aria-label={`Description for ${group.name}`}
                          />
                        </form>
                      )}
                      <ul>
                        {(group.shelf
                          ? [
                              ...group.books,
                              ...allBooks.filter((b) => !b.shelfIds.includes(group.id)),
                            ]
                          : group.books
                        ).map((book) => (
                          <li key={book.id}>
                            <span>{book.title}</span>
                            {group.shelf && book.shelfIds.includes(group.id) && (
                              <span className="reader-shelf-toolbar">
                                {(["up", "down"] as const).map((action) => (
                                  <button
                                    key={action}
                                    className={control}
                                    disabled={
                                      busy ||
                                      (action === "up"
                                        ? group.books[0]?.id === book.id
                                        : group.books.at(-1)?.id === book.id)
                                    }
                                    aria-label={`Move ${book.title} ${action} on ${group.name}`}
                                    onClick={() =>
                                      run({
                                        type: "shelfManage",
                                        key: crypto.randomUUID(),
                                        shelfId: group.id,
                                        userBookId: book.id,
                                        expectedVersion: group.shelf!.version,
                                        action,
                                      })
                                    }
                                  >
                                    {action === "up" ? "↑" : "↓"}
                                  </button>
                                ))}
                              </span>
                            )}
                            {group.shelf ? (
                              <button
                                className={control}
                                disabled={busy}
                                onClick={() =>
                                  run({
                                    type: "shelfItem",
                                    key: crypto.randomUUID(),
                                    shelfId: group.id,
                                    userBookId: book.id,
                                    expectedVersion: group.shelf!.version,
                                    present: !book.shelfIds.includes(group.id),
                                  })
                                }
                              >
                                {book.shelfIds.includes(group.id) ? "Remove" : "Add"}
                              </button>
                            ) : (
                              <select
                                className={control}
                                value=""
                                aria-label={`Place ${book.title} on shelf`}
                                disabled={busy || !shelves.data?.length}
                                onChange={(e) => {
                                  const shelf = shelves.data!.find((s) => s.id === e.target.value)!;
                                  run({
                                    type: "shelfItem",
                                    key: crypto.randomUUID(),
                                    shelfId: shelf.id,
                                    userBookId: book.id,
                                    expectedVersion: shelf.version,
                                    present: true,
                                  });
                                }}
                              >
                                <option value="">Place on shelf…</option>
                                {shelves.data?.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </li>
                        ))}
                      </ul>
                      {group.shelf &&
                        (deleting === group.id ? (
                          <div role="alert" className="space-y-3">
                            <p>
                              Delete “{group.name}”? All books and reading history stay in your
                              library.
                            </p>
                            <button
                              className={control}
                              disabled={busy}
                              onClick={() => {
                                run({
                                  type: "shelfManage",
                                  key: crypto.randomUUID(),
                                  shelfId: group.id,
                                  expectedVersion: group.shelf!.version,
                                  action: "delete",
                                });
                                setDeleting(null);
                                setSelectedShelf("");
                              }}
                            >
                              Delete shelf
                            </button>
                            <button className={control} onClick={() => setDeleting(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className={control}
                            disabled={busy}
                            onClick={() => setDeleting(group.id)}
                          >
                            Delete shelf…
                          </button>
                        ))}
                    </details>
                  </article>
                ))}
              {inCollections && (collectionType === "series" || collectionType === "queue") && (
                <details className="reader-card reader-card-body">
                  <summary>
                    Manage {collectionType === "queue" ? "reading queue" : "series & books"}
                  </summary>
                  <ReadingOrganization
                    sessionId={sessionId}
                    openBook={openBook}
                    mode={collectionType}
                    seriesId={collectionType === "series" ? collectionId : undefined}
                  />
                </details>
              )}
              {pageCount > 1 && (
                <nav className="reader-pagination" aria-label="Library pages">
                  <button
                    className={control}
                    disabled={page === 1 || library.isFetching}
                    onClick={() => update({ page: page - 1 })}
                  >
                    Previous
                  </button>
                  {[
                    ...new Set([
                      1,
                      Math.max(1, page - 1),
                      page,
                      Math.min(pageCount, page + 1),
                      pageCount,
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((number, index, pages) => (
                      <span key={number} className="reader-pagination-step">
                        {index > 0 && number - pages[index - 1] > 1 && (
                          <span aria-hidden="true">…</span>
                        )}
                        <button
                          className={control}
                          aria-label={`Page ${number}`}
                          aria-current={page === number ? "page" : undefined}
                          disabled={library.isFetching}
                          onClick={() => update({ page: number })}
                        >
                          {number}
                        </button>
                      </span>
                    ))}
                  <button
                    className={control}
                    disabled={page === pageCount || library.isFetching}
                    onClick={() => update({ page: page + 1 })}
                  >
                    Next
                  </button>
                </nav>
              )}
              {!listBooks.length && (
                <p>
                  {allBooks.length
                    ? "No books match these filters."
                    : "Find a book in Search to start filling your shelves."}
                </p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
