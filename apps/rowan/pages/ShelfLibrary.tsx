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
import { useQueries, useQuery } from "@tanstack/react-query";
import { rowanLibrary, rowanShelves, rowanLibraryFacets } from "@/lib/rowan-fns";
import { ShelfBooks } from "@/components/rowan/PhysicalShelf";
import { BookCover } from "@/components/rowan/BookCover";
import { ReadingOrganization } from "@/components/rowan/ReadingOrganization";
import { ReadingProgressBar } from "@/components/rowan/ReadingProgressBar";
import { control, statuses, useReader, useReadingCommands } from "../components/reader";

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
  const shelfOverview = !inCollections && view === "shelves" && !selectedShelf;
  const collectionType = section === "series" || !collection ? "series" : collection;
  const filterCount = [
    status !== "all",
    !inCollections && !!selectedShelf,
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
    enabled: !shelfOverview && (!inCollections || (collectionType === "shelf" && !!selectedShelf)),
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
  // Membership and ordering are applied by the server before pagination.
  // Never intersect a shelf with a page of the entire library.
  const allBooks = library.data?.items ?? [];
  const listBooks = allBooks;
  const authors = facets.data?.authors ?? [];
  const years = facets.data?.years ?? [];
  const activeShelf = shelves.data?.find((shelf) => shelf.id === selectedShelf);
  const activeFilters: Array<{ label: string; clear: Partial<typeof browsing> }> = [
    ...(query ? [{ label: `Search: ${query}`, clear: { query: "" } }] : []),
    ...(status !== "all"
      ? [{ label: statuses[status as keyof typeof statuses] ?? status, clear: { status: "all" } }]
      : []),
    ...(!inCollections && selectedShelf
      ? [{ label: activeShelf?.name ?? "Unfiled books", clear: { shelf: "" } }]
      : []),
    ...(format !== "all"
      ? [
          {
            label:
              format === "book" ? "Print" : format === "unknown" ? "Unspecified format" : format,
            clear: { format: "all" },
          },
        ]
      : []),
    ...(author ? [{ label: author, clear: { author: "" } }] : []),
    ...(year ? [{ label: `Finished in ${year}`, clear: { year: "" } }] : []),
    ...(favorite ? [{ label: "Favorites", clear: { favorite: false } }] : []),
    ...(read ? [{ label: "Previously read", clear: { read: false } }] : []),
  ];
  // Each shelf preview has its own membership query. A small shelf must not
  // lose members merely because they land on another global library page.
  const overviewShelves = [
    ...(shelves.data ?? []).map((shelf) => ({ id: shelf.id, name: shelf.name, shelf })),
    { id: "unfiled", name: "Unfiled books", shelf: undefined as Shelf | undefined },
  ];
  const shelfPreviews = useQueries({
    queries: overviewShelves.map((group) => ({
      queryKey: [
        "rowan",
        sessionId,
        "shelf-preview",
        group.id,
        query,
        status,
        sort,
        favorite,
        read,
        format,
        author,
        year,
        timeZone,
      ],
      enabled: shelfOverview && !!shelves.data,
      queryFn: () =>
        rowanLibrary({
          data: {
            sessionId,
            offset: 0,
            query,
            status,
            sort,
            favoritesOnly: favorite,
            read,
            format: format as "all" | "book" | "ebook" | "audiobook" | "unknown",
            author,
            year,
            timeZone,
            shelfId: group.shelf?.id,
            unfiled: group.id === "unfiled",
          },
        }),
    })),
  });
  const groups = shelfOverview
    ? overviewShelves
        .map((group, index) => ({
          ...group,
          books: shelfPreviews[index].data?.items ?? [],
          total: shelfPreviews[index].data?.total ?? 0,
          loading: shelfPreviews[index].isPending,
          error: shelfPreviews[index].isError,
          retry: () => void shelfPreviews[index].refetch(),
        }))
        .filter(
          (group) => group.id !== "unfiled" || group.loading || group.error || group.total > 0,
        )
    : [
        {
          id: selectedShelf || "all",
          name: activeShelf?.name ?? (selectedShelf === "unfiled" ? "Unfiled books" : "Your books"),
          shelf: activeShelf,
          books: allBooks,
          total,
          loading: false,
          error: false,
          retry: () => void library.refetch(),
        },
      ];
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
      {inCollections && (
        <nav className="reader-library-switch" aria-label="Collection views">
          {(["series", "queue", "shelf"] as const).map((type) => (
            <button
              key={type}
              className={collectionType === type ? "is-selected" : ""}
              aria-pressed={collectionType === type}
              onClick={() => chooseCollection(type)}
            >
              {type === "series" ? (
                <Layers size={18} aria-hidden="true" />
              ) : type === "queue" ? (
                <List size={18} aria-hidden="true" />
              ) : (
                <Library size={18} aria-hidden="true" />
              )}
              {type === "series" ? "Series" : type === "queue" ? "Queue" : "Shelves"}
            </button>
          ))}
        </nav>
      )}
      {inCollections && collectionType !== "shelf" ? (
        <section className="reader-card reader-card-body">
          <ReadingOrganization
            sessionId={sessionId}
            openBook={openBook}
            mode={collectionType === "queue" ? "queue" : "series"}
            seriesId={collectionType === "series" && collectionId ? collectionId : undefined}
          />
        </section>
      ) : inCollections && !selectedShelf ? (
        <section className="reader-card reader-card-body space-y-5">
          <header>
            <h2>Your shelves</h2>
            <p className="reader-muted">Keep books together in a way that makes sense to you.</p>
          </header>
          {shelves.isPending && <p role="status">Loading shelves…</p>}
          {shelves.isError && (
            <p role="alert">
              Shelves could not load. <button onClick={() => void shelves.refetch()}>Retry</button>
            </p>
          )}
          <div className="reader-collection-shelves">
            {shelves.data?.map((shelf) => (
              <button
                key={shelf.id}
                className="reader-collection-shelf"
                onClick={() => chooseCollection("shelf", shelf.id)}
              >
                <Library size={24} aria-hidden="true" />
                <span>
                  <strong>{shelf.name}</strong>
                  {shelf.description && <small>{shelf.description}</small>}
                </span>
                <span className="reader-count">{shelf.bookIds.length} books</span>
              </button>
            ))}
          </div>
          {shelves.data?.length === 0 && <p>No shelves yet. Create your first one below.</p>}
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
              placeholder="Name your shelf…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
            <button className={control} disabled={busy || !name.trim()}>
              <Plus size={16} aria-hidden="true" /> Create shelf
            </button>
          </form>
        </section>
      ) : (
        <section className="reader-shelf-library">
          {inCollections && (
            <header className="space-y-3">
              <button className={control} onClick={() => chooseCollection("shelf")}>
                ← All shelves
              </button>
              <h2>{activeShelf?.name ?? "Your shelf"}</h2>
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
              <header className="reader-filter-heading">
                <div>
                  <h3>Refine your library</h3>
                  <p className="reader-muted">Find the right book for right now.</p>
                </div>
                <button
                  type="button"
                  className={control}
                  aria-label="Close filters"
                  onClick={() => setFiltersOpen(false)}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </header>
              <div className="reader-filter-fields">
                <label className="reader-filter-field">
                  <span>Sort by</span>
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
                </label>
                <label className="reader-filter-field">
                  <span>Format</span>
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
                </label>
                <label className="reader-filter-field">
                  <span>Author</span>
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
                </label>
                <label className="reader-filter-field">
                  <span>Finished in</span>
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
                </label>
                <label className="reader-filter-field">
                  <span>Reading status</span>
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
                </label>
                {!inCollections && (
                  <label className="reader-filter-field">
                    <span>Shelf</span>
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
                  </label>
                )}
              </div>
              <footer className="reader-filter-footer">
                <div className="reader-filter-options">
                  <button
                    className={control}
                    aria-pressed={favorite}
                    onClick={() => update({ favorite: !favorite })}
                  >
                    <Heart size={16} aria-hidden="true" /> Favorites
                  </button>
                  <button
                    className={control}
                    aria-pressed={read}
                    onClick={() => update({ read: !read })}
                  >
                    <BookCheck size={16} aria-hidden="true" /> Previously read
                  </button>
                </div>
                <button
                  className={control}
                  onClick={() =>
                    update({
                      status: "all",
                      shelf: inCollections ? selectedShelf : "",
                      format: "all",
                      author: "",
                      year: "",
                      favorite: false,
                      read: false,
                      sort: "shelf",
                    })
                  }
                >
                  Reset filters
                </button>
              </footer>
            </div>
          )}
          {!!activeFilters.length && (
            <div className="reader-active-filters" aria-label="Active library filters">
              {activeFilters.map((filter, index) => (
                <button
                  key={index}
                  className={control}
                  aria-label={`Remove filter: ${filter.label}`}
                  onClick={() => update(filter.clear)}
                >
                  {filter.label}
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
              <button
                className={control}
                onClick={() =>
                  update({
                    query: "",
                    status: "all",
                    shelf: inCollections ? selectedShelf : "",
                    format: "all",
                    author: "",
                    year: "",
                    favorite: false,
                    read: false,
                    sort: "shelf",
                  })
                }
              >
                Clear all
              </button>
            </div>
          )}
          <div className="reader-library-controls">
            <p role="status" className="text-sm text-muted-foreground">
              {shelfOverview
                ? "Browse your shelves below"
                : total
                  ? `${(page - 1) * 24 + 1}–${Math.min(page * 24, total)} of ${total} books`
                  : "No matching books"}
              {filterCount ? " · Filters applied" : ""}
            </p>
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
              <details className="reader-new-shelf">
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
          {((!shelfOverview && library.isPending) || shelves.isPending) && (
            <p role="status">Placing your books on their shelves…</p>
          )}
          {((!shelfOverview && library.isError) || shelves.isError) && (
            <p role="alert">
              Your shelves could not load.{" "}
              <button
                onClick={() => {
                  void library.refetch();
                  void shelves.refetch();
                }}
              >
                Retry
              </button>
            </p>
          )}
          {(shelfOverview || (!library.isPending && !library.isError)) &&
            !shelves.isPending &&
            !shelves.isError && (
              <>
                {view !== "shelves" ? (
                  <ul className={view === "grid" ? "reader-library-grid" : "reader-library-list"}>
                    {listBooks.map((book) => (
                      <li
                        className={`reader-library-tile reader-library-tile-${view}`}
                        key={book.id}
                      >
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
                ) : null}
                {(view === "shelves" || (inCollections && collectionType === "shelf")) &&
                  (!inCollections || collectionType === "shelf") &&
                  groups.map((group) => (
                    <article className="reader-physical-shelf" key={group.id}>
                      <header>
                        <h2>{group.name}</h2>
                        <span>
                          {group.loading
                            ? "Loading…"
                            : `${group.books.length} shown · ${group.total} matching books`}
                        </span>
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
                      {group.error && (
                        <p role="alert">
                          Books could not load. <button onClick={group.retry}>Retry</button>
                        </p>
                      )}
                      {shelfOverview && !group.loading && !group.error && (
                        <button className={control} onClick={() => update({ shelf: group.id })}>
                          {group.total > 24 ? `Browse all ${group.total} books →` : "Open shelf →"}
                        </button>
                      )}
                      {view === "shelves" && !group.loading && !group.error && (
                        <ShelfBooks books={group.books} view={view} openBook={openBook} />
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
                                description: String(
                                  new FormData(e.currentTarget).get("description"),
                                ),
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
                                          ? group.shelf?.bookIds[0] === book.id
                                          : group.shelf?.bookIds.at(-1) === book.id)
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
                                    const shelf = shelves.data!.find(
                                      (s) => s.id === e.target.value,
                                    )!;
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
                {!shelfOverview && pageCount > 1 && (
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
                {!shelfOverview && !listBooks.length && (
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
