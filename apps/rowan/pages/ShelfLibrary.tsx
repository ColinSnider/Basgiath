import { useState } from "react";
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
import { rowanLibrary, rowanShelves } from "@/lib/rowan-fns";
import { ShelfBooks } from "@/components/rowan/PhysicalShelf";
import { BookCover } from "@/components/rowan/BookCover";
import { ReadingOrganization } from "@/components/rowan/ReadingOrganization";
import { ReadingProgressBar } from "@/components/rowan/ReadingProgressBar";
import { control, statuses, useReader, useReadingCommands } from "../components/reader";

type Book = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];
type Shelf = Awaited<ReturnType<typeof rowanShelves>>[number];
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
  } = browsing;
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
      search: { ...browsing, ...patch },
      replace: true,
      resetScroll: false,
    });
  const setView = (view: typeof browsing.view) => update({ view });
  const setSection = (section: typeof browsing.section) => update({ section });
  const setQuery = (query: string) => update({ query });
  const setStatus = (status: string) => update({ status });
  const setSelectedShelf = (shelf: string) => update({ shelf });
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const shelves = useQuery({
    queryKey: ["rowan", sessionId, "shelves"],
    queryFn: () => rowanShelves({ data: { sessionId } }),
  });
  const library = useQuery({
    queryKey: ["rowan", sessionId, "shelf-library"],
    queryFn: async () => {
      const books: Book[] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page: Awaited<ReturnType<typeof rowanLibrary>> = await rowanLibrary({
          data: { sessionId, offset, query: "", status: "all", sort: "title" },
        });
        books.push(...page.items);
        offset = page.nextOffset;
      }
      return books;
    },
  });
  const matches = (book: Book) =>
    (!favorite || book.isFavorite) &&
    (!read || book.hasRead) &&
    (format === "all" || (book.format || "unknown") === format) &&
    (!author || book.authors.includes(author)) &&
    (!year || book.readYears.includes(year)) &&
    (status === "all" || book.status === status) &&
    `${book.title} ${book.authors.join(" ")}`.toLowerCase().includes(query.toLowerCase());
  const allBooks = library.data ?? [];
  const authors = [...new Set(allBooks.flatMap((book) => book.authors))].sort();
  const years = [...new Set(allBooks.flatMap((book) => book.readYears))].sort().reverse();
  const ordered = (books: Book[]) =>
    [...books].sort((a, b) => {
      const date = (value: string | Date | null) => (value ? new Date(value).getTime() : 0);
      const order =
        sort === "shelf"
          ? 0
          : sort === "title"
            ? a.title.localeCompare(b.title)
            : sort === "author"
              ? a.authors.join(", ").localeCompare(b.authors.join(", "))
              : sort === "newest"
                ? date(b.addedAt) - date(a.addedAt)
                : sort === "oldest"
                  ? date(a.addedAt) - date(b.addedAt)
                  : sort === "finished"
                    ? date(b.lastFinishedAt) - date(a.lastFinishedAt)
                    : (b.format === "audiobook" ? 0 : (b.total ?? 0)) -
                      (a.format === "audiobook" ? 0 : (a.total ?? 0));
      return order || (sort === "shelf" ? 0 : a.id.localeCompare(b.id));
    });
  const unfiled = allBooks.filter((b) => !b.shelfIds.length);
  const groups = [
    ...(shelves.data ?? []).map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      shelf,
      books: shelf.bookIds.flatMap((id) => {
        const book = allBooks.find((b) => b.id === id);
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
      (!selectedShelf || selectedShelf === g.id) &&
      (g.id !== "unfiled" || g.books.length > 0 || !shelves.data?.length),
  );
  const listBooks = ordered(
    allBooks.filter(
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
          className={section === "books" ? "is-selected" : ""}
          aria-pressed={section === "books"}
          onClick={() => setSection("books")}
        >
          <Library size={18} className="inline mr-2" aria-hidden="true" />
          Library <span>{allBooks.length} books</span>
        </button>
        <button
          className={section === "series" ? "is-selected" : ""}
          aria-pressed={section === "series"}
          onClick={() => setSection("series")}
        >
          <Layers size={18} className="inline mr-2" aria-hidden="true" />
          Series & queue
        </button>
      </nav>
      {section === "series" ? (
        <ReadingOrganization sessionId={sessionId} openBook={openBook} />
      ) : (
        <section className="reader-shelf-library">
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
                    shelf: "Shelf order / title",
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
                  aria-label="Completion year (UTC)"
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
              </div>
            </div>
          )}
          <p role="status" className="text-sm text-muted-foreground">
            {listBooks.length} of {allBooks.length} books{filterCount ? " · Filters applied" : ""}
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
          </div>
          {(library.isPending || shelves.isPending) && (
            <p role="status">Placing your books on their shelves…</p>
          )}
          {(library.isError || shelves.isError) && (
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
              ) : (
                groups.map((group) => (
                  <article className="reader-physical-shelf" key={group.id}>
                    <header>
                      <h2>{group.name}</h2>
                      <span>
                        {group.books.length} {group.books.length === 1 ? "book" : "books"}
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
                    <ShelfBooks
                      books={ordered(group.books.filter(matches))}
                      view={view}
                      openBook={openBook}
                    />
                    <details className="reader-shelf-organize">
                      <summary>Organize this shelf</summary>
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
                ))
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
