import { useState } from "react";
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
  const [view, setView] = useState<"grid" | "shelves" | "list">("grid");
  const [section, setSection] = useState<"books" | "series">("books");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedShelf, setSelectedShelf] = useState("");
  const [name, setName] = useState("");
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
    (status === "all" || book.status === status) &&
    `${book.title} ${book.authors.join(" ")}`.toLowerCase().includes(query.toLowerCase());
  const allBooks = library.data ?? [];
  const unfiled = allBooks.filter((b) => !b.shelfIds.length);
  const groups = [
    ...(shelves.data ?? []).map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      shelf,
      books: allBooks.filter((b) => b.shelfIds.includes(shelf.id)),
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
  const listBooks = allBooks.filter(
    (b) =>
      matches(b) &&
      (!selectedShelf ||
        (selectedShelf === "unfiled" ? !b.shelfIds.length : b.shelfIds.includes(selectedShelf))),
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
          Library <span>{allBooks.length} books</span>
        </button>
        <button
          className={section === "series" ? "is-selected" : ""}
          aria-pressed={section === "series"}
          onClick={() => setSection("series")}
        >
          Series & queue
        </button>
      </nav>
      {section === "series" ? (
        <ReadingOrganization sessionId={sessionId} openBook={openBook} />
      ) : (
        <section className="reader-shelf-library">
          <div className="reader-shelf-toolbar">
            <input
              className={control}
              aria-label="Find a book"
              placeholder="Find a book or author…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
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
                  {mode === "shelves" ? "Shelves" : mode === "grid" ? "Grid" : "List"}
                </button>
              ))}
            </div>
            <details>
              <summary>New shelf</summary>
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
                          <small className="block">{book.authors.join(", ") || "Unknown author"}</small>
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
                    <ShelfBooks
                      books={group.books.filter(matches)}
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
                            Rename
                          </button>
                        </form>
                      )}
                      <ul>
                        {(group.shelf ? allBooks : group.books).map((book) => (
                          <li key={book.id}>
                            <span>{book.title}</span>
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
