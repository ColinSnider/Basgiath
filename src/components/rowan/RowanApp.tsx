import { useRowanTheme } from "./useRowanTheme";
import { ReadingPanel } from "./ReadingPanel";
import { AccountSettings } from "@/components/rowan/AccountSettings";
import { Link, Navigate, useLocation, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Home,
  Library,
  Search,
  CalendarDays,
  ChartNoAxesCombined,
  Target,
  NotebookPen,
  Settings,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { RowanHome } from "@/components/rowan/Home";
import { ReadingCalendar } from "@/components/rowan/ReadingCalendar";
import { Insights } from "@/components/rowan/Insights";
import { ManualBook } from "@/components/rowan/ManualBook";
import { Journal } from "@/components/rowan/Journal";
import { Goals } from "@/components/rowan/Goals";
import { DataSyncPanel } from "@/components/rowan/DataSyncPanel";
import {
  rowanLibrary,
  rowanSearch,
  rowanMutate,
  rowanShelves,
  rowanArchive,
  type RowanCommand,
} from "@/lib/rowan-fns";

const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
const statuses = {
  all: "All books",
  reading: "Currently reading",
  paused: "Paused",
  want_to_read: "Up next",
  read: "Finished",
  dnf: "Did not finish",
};
type Item = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];

export function Rowan({
  enabled,
  googleBooksEnabled,
  standalone = false,
}: {
  enabled: boolean;
  googleBooksEnabled: boolean;
  standalone?: boolean;
}) {
  const { sessionId, user, loading } = useAuth();
  if (loading)
    return (
      <main className="p-8" role="status">
        Loading Rowan…
      </main>
    );
  if (!enabled)
    return (
      <main className="p-8">
        <h1 className="font-display text-3xl">Rowan</h1>
        <p className="mt-3">Rowan is not enabled for this environment.</p>
      </main>
    );
  if (standalone && (!sessionId || user?.isGuest)) return <Navigate to="/login" />;
  if (!sessionId || user?.isGuest)
    return (
      <main className="p-8">
        <Link to="/login">Sign in to use Rowan</Link>
      </main>
    );
  return (
    <Workspace
      key={sessionId}
      sessionId={sessionId}
      googleBooksEnabled={googleBooksEnabled}
      standalone={standalone}
    />
  );
}

function Workspace({
  sessionId,
  googleBooksEnabled,
  standalone,
}: {
  sessionId: string;
  googleBooksEnabled: boolean;
  standalone: boolean;
}) {
  const { logout } = useAuth();
  useRowanTheme(sessionId);
  const { pathname } = useLocation();
  const router = useRouter();
  const page = pathname.replace(/\/+$/, "").slice(1) || "home";
  const show = (name: string) => !standalone || (!selected && page === name);
  const goLibrary = () => {
    if (standalone) void router.navigate({ href: "/library" });
    else document.getElementById("library-heading")?.scrollIntoView({ behavior: "smooth" });
  };
  const [catalogSource, setCatalogSource] = useState<"openlibrary" | "googlebooks">(
    googleBooksEnabled ? "googlebooks" : "openlibrary",
  );
  const cache = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [shelfId, setShelfId] = useState("");
  const [shelfName, setShelfName] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const shelves = useQuery({
    queryKey: ["rowan", sessionId, "shelves"],
    queryFn: () => rowanShelves({ data: { sessionId } }),
    enabled: show("library") || !!selected,
    retry: false,
  });
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"grid" | "list" | "bookshelf">("grid");
  const [sort, setSort] = useState<"newest" | "oldest" | "title" | "rating">("newest");
  const [searchText, setSearchText] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [includeExtras, setIncludeExtras] = useState(false);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const retry = useRef<RowanCommand | null>(null);
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
    enabled: show("library"),
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ["rowan", sessionId, "search", catalogQuery, catalogSource, includeExtras],
    queryFn: () =>
      rowanSearch({
        data: { sessionId, query: catalogQuery, source: catalogSource, includeExtras },
      }),
    enabled: show("search") && !!catalogQuery,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (command: RowanCommand) => rowanMutate({ data: { sessionId, command } }),
    onSuccess: async (result) => {
      retry.current = null;
      setNotice(result.ok ? "Saved." : result.message);
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
    onError: () =>
      setNotice("The result could not be confirmed. Retry to safely confirm this change."),
  });
  function run(command: RowanCommand) {
    if (mutation.isPending || retry.current) return;
    retry.current = command;
    setNotice("");
    mutation.mutate(command);
  }
  const busy = mutation.isPending || !!retry.current;
  return (
    <main
      data-standalone={standalone || undefined}
      className="rowan-workspace mx-auto space-y-8 p-5"
    >
      <header className="rowan-header flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            A reader’s companion
          </p>
          <h1 className="font-display text-4xl text-primary">Rowan</h1>
        </div>
        {standalone ? (
          <button
            className={control}
            onClick={async () => {
              await logout();
              cache.clear();
            }}
          >
            Sign out
          </button>
        ) : (
          <a className={control} href="/library">
            Basgiath library
          </a>
        )}
      </header>
      <nav
        aria-label="Rowan navigation"
        className="rowan-navigation flex flex-wrap gap-3 sticky top-0 z-10 bg-background py-3 border-b border-border"
      >
        <div className="rowan-brand hidden">
          <BookOpen size={24} strokeWidth={1.5} />
          <span className="font-display text-3xl">Rowan</span>
          <p>Your reading companion</p>
        </div>
        <p className="rowan-nav-label hidden">Your workspace</p>
        {[
          ["home", "/", "#reading-home", "Home", Home],
          ["library", "/library", "#library-heading", "All books", Library],
          ["search", "/search", "#find-books", "Find books", Search],
          ["calendar", "/calendar", "#reading-history", "Calendar", CalendarDays],
          ["insights", "/insights", "#insights", "Insights", ChartNoAxesCombined],
          ["goals", "/goals", "#goals", "Goals", Target],
          ["margins", "/margins", "#journal", "Margins", NotebookPen],
          ["account", "/account", "#rowan-settings", "Account", UserRound],
        ].map(([name, path, anchor, label, Icon]) => (
          <a
            key={String(name)}
            className={control}
            href={String(standalone ? path : anchor)}
            aria-current={standalone && page === name ? "page" : undefined}
            onClick={(event) => {
              if (
                !standalone ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              setSelected(null);
              void router.navigate({ href: String(path) });
            }}
          >
            {typeof Icon !== "string" && (
              <Icon className="hidden lg:block" size={18} strokeWidth={1.5} />
            )}{" "}
            {String(label)}
          </a>
        ))}
        <button
          className={control}
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const json = await rowanArchive({ data: { sessionId } });
              const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = `rowan-archive-${new Date().toISOString().slice(0, 10)}.json`;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setNotice(
                "Archive downloaded. Keep it somewhere safe. Restore it from Settings when needed.",
              );
            } catch {
              setNotice("Your archive could not be downloaded. Try again.");
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Exporting…" : "Export archive"}
        </button>
      </nav>
      <nav className="rowan-mobile-tabs" aria-label="Primary Rowan navigation">
        {[
          ["home", "/", "Home", Home],
          ["library", "/library", "Library", Library],
          ["search", "/search", "Search", Search],
          ["calendar", "/calendar", "History", CalendarDays],
          ["account", "/account", "Account", UserRound],
        ].map(([name, path, label, Icon]) => (
          <a key={String(name)} href={String(path)} aria-current={page === name ? "page" : undefined}>
            {typeof Icon !== "string" && <Icon size={20} strokeWidth={1.8} />}
            <span>{String(label)}</span>
          </a>
        ))}
      </nav>
      {show("home") && (
        <RowanHome
          sessionId={sessionId}
          openBook={(book) => setSelected({ ...book, tags: [] })}
          showLibrary={goLibrary}
        />
      )}
      {show("calendar") && (
        <div id="reading-history">
          <ReadingCalendar
            sessionId={sessionId}
            openBook={(book) => setSelected({ ...book, tags: [] })}
          />
        </div>
      )}
      {show("search") && (
        <>
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
                <p>Catalog search is unavailable.</p>
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
              <ul className="max-h-80 overflow-auto divide-y divide-border">
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
      )}
      <div className="rowan-notice" role="status" aria-live="polite">
        {notice}
        {mutation.isError && retry.current && (
          <button
            className={`${control} ml-3`}
            disabled={mutation.isPending}
            onClick={() => retry.current && mutation.mutate(retry.current)}
          >
            Retry change
          </button>
        )}
      </div>
      {show("library") && (
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
                  setSelected(null);
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
                    setSelected(null);
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
                setSelected(null);
              }}
            />
            <select
              aria-label="Reading status"
              className={control}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
                setSelected(null);
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
                setSelected(null);
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
                : "Your Rowan library starts here. Search above to save your first book."}
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
                  onClick={() => setSelected(book)}
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
                setSelected(null);
                setOffset(Math.max(0, offset - 24));
              }}
            >
              Previous
            </button>
            <button
              className={control}
              disabled={library.data?.nextOffset == null || library.isFetching}
              onClick={() => {
                setSelected(null);
                setOffset(library.data!.nextOffset!);
              }}
            >
              Next
            </button>
          </div>
        </section>
      )}
      {show("insights") && <Insights sessionId={sessionId} run={run} busy={busy} />}
      {show("goals") && <Goals sessionId={sessionId} />}
      {(show("account") || show("settings")) && (
        <AccountSettings
          sessionId={sessionId}
          standalone={standalone}
          onReplaced={() => {
            setSelected(null);
            setOffset(0);
            setShelfId("");
          }}
        />
      )}
      {!standalone && <DataSyncPanel sessionId={sessionId} />}
      {show("margins") && (
        <Journal sessionId={sessionId} openBook={(book) => setSelected({ ...book, tags: [] })} />
      )}
      {selected && (
        <ReadingPanel
          key={selected.id}
          book={library.data?.items.find((b) => b.id === selected.id) ?? selected}
          sessionId={sessionId}
          busy={busy}
          shelves={shelves.data ?? []}
          run={run}
          close={() => setSelected(null)}
        />
      )}
    </main>
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
