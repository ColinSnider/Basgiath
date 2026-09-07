import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Margins } from "@/components/rowan/Margins";
import { RowanHome } from "@/components/rowan/Home";
import { ReadingCalendar } from "@/components/rowan/ReadingCalendar";
import {
  rowanStatus,
  rowanLibrary,
  rowanSearch,
  rowanHistory,
  rowanMutate,
  rowanShelves,
  type RowanCommand,
} from "@/lib/rowan-fns";

export const Route = createFileRoute("/rowan")({
  loader: () => rowanStatus(),
  head: () => ({ meta: [{ title: "Rowan — Your library" }] }),
  component: Rowan,
});
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

function Rowan() {
  const { enabled } = Route.useLoaderData();
  const { sessionId, user } = useAuth();
  if (!enabled)
    return (
      <main className="p-8">
        <h1 className="font-display text-3xl">Rowan</h1>
        <p className="mt-3">This development workspace is not enabled.</p>
      </main>
    );
  if (!sessionId || user?.isGuest)
    return (
      <main className="p-8">
        <Link to="/login">Sign in to use Rowan</Link>
      </main>
    );
  return <Workspace key={sessionId} sessionId={sessionId} />;
}

function Workspace({ sessionId }: { sessionId: string }) {
  const cache = useQueryClient();
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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchText, setSearchText] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [notice, setNotice] = useState("");
  const retry = useRef<RowanCommand | null>(null);
  const library = useQuery({
    queryKey: ["rowan", sessionId, "library", query, status, offset, favoritesOnly, shelfId],
    queryFn: () =>
      rowanLibrary({
        data: { sessionId, query, status, offset, favoritesOnly, shelfId: shelfId || undefined },
      }),
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ["rowan", sessionId, "search", catalogQuery],
    queryFn: () => rowanSearch({ data: { sessionId, query: catalogQuery } }),
    enabled: !!catalogQuery,
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
    <main className="mx-auto max-w-6xl space-y-8 p-5 md:p-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            A reader’s companion
          </p>
          <h1 className="font-display text-4xl">Rowan</h1>
        </div>
        <Link className={control} to="/library">
          Basgiath library
        </Link>
      </header>
      <RowanHome
        sessionId={sessionId}
        openBook={setSelected}
        showLibrary={() =>
          document
            .getElementById("library-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      />
      <ReadingCalendar sessionId={sessionId} openBook={setSelected} />
      <section
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
        aria-label="Find a book"
      >
        <h2 className="font-display text-2xl">Your next good book</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCatalogQuery(searchText.trim());
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
        {catalog.isFetching && <p role="status">Searching Open Library…</p>}
        {catalog.isError && <p role="alert">Catalog search is unavailable. Please try again.</p>}
        {catalog.data && !catalog.data.length && (
          <p>No matching books. Try another title or author.</p>
        )}
        {!!catalog.data?.length && (
          <ul className="max-h-80 overflow-auto divide-y divide-border">
            {catalog.data.map((book) => (
              <li key={book.ref.externalId} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{book.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {book.authors.join(", ") || "Unknown author"}
                  </p>
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
      <div role="status" aria-live="polite">
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
      <section className="space-y-4" aria-labelledby="library-heading">
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
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              className={control}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode === "grid" ? "Grid" : "List"}
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
        <ul className={view === "grid" ? "grid grid-cols-2 gap-4 lg:grid-cols-4" : "space-y-3"}>
          {library.data?.items.map((book) => (
            <li key={book.id}>
              <button
                className={`w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary ${view === "list" ? "flex items-center gap-4" : "h-full"}`}
                onClick={() => setSelected(book)}
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt=""
                    loading="lazy"
                    className={`rounded object-contain ${view === "grid" ? "h-40 w-full mb-3" : "h-16 w-12"}`}
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

function ReadingPanel({
  book,
  sessionId,
  busy,
  run,
  close,
  shelves,
}: {
  book: Item;
  sessionId: string;
  busy: boolean;
  run: (command: RowanCommand) => void;
  close: () => void;
  shelves: Awaited<ReturnType<typeof rowanShelves>>;
}) {
  const [unit, setUnit] = useState<"page" | "second" | "percent">("page");
  const [position, setPosition] = useState("");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "start" });
  }, []);
  const history = useQuery({
    queryKey: ["rowan", sessionId, "history", book.id],
    queryFn: () => rowanHistory({ data: { sessionId, userBookId: book.id } }),
    retry: false,
  });
  const active = history.data?.sessions.find((s) => s.state === "active" || s.state === "paused");
  const value = Number(position);
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="rounded-2xl border border-primary bg-card p-5 space-y-4"
      aria-label={`Reading details for ${book.title}`}
    >
      <div className="flex justify-between gap-3">
        <h2 className="font-display text-2xl">{book.title}</h2>
        <button className={control} onClick={close}>
          Close
        </button>
      </div>
      {history.isPending && <p>Loading reading history…</p>}
      {history.isError && (
        <p role="alert">
          History could not load.{" "}
          <button className={control} onClick={() => void history.refetch()}>
            Retry
          </button>
        </p>
      )}
      {history.data && (
        <>
          <Margins margins={history.data.margins} userBookId={book.id} busy={busy} run={run} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={control}
              disabled={busy}
              aria-pressed={history.data.isFavorite}
              onClick={() =>
                run({
                  type: "personalize",
                  key: crypto.randomUUID(),
                  userBookId: book.id,
                  expectedVersion: history.data!.userBookVersion,
                  isFavorite: !history.data!.isFavorite,
                })
              }
            >
              {history.data.isFavorite ? "♥ Favorite" : "♡ Add to favorites"}
            </button>
            <label className="text-sm">
              Your rating{" "}
              <select
                className={control}
                disabled={busy}
                value={history.data.halfStars ?? ""}
                onChange={(e) =>
                  run({
                    type: "personalize",
                    key: crypto.randomUUID(),
                    userBookId: book.id,
                    expectedVersion: history.data!.userBookVersion,
                    halfStars: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">Not rated</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                  <option key={value} value={value}>
                    {value / 2} / 5
                  </option>
                ))}
              </select>
            </label>
          </div>
          {shelves.length > 0 && (
            <fieldset className="flex flex-wrap gap-3">
              <legend className="mb-2 text-sm font-medium">On your shelves</legend>
              {shelves.map((shelf) => (
                <label className="flex items-center gap-2 text-sm" key={shelf.id}>
                  <input
                    type="checkbox"
                    checked={history.data!.shelfIds.includes(shelf.id)}
                    disabled={busy}
                    onChange={(e) =>
                      run({
                        type: "shelfItem",
                        key: crypto.randomUUID(),
                        shelfId: shelf.id,
                        userBookId: book.id,
                        present: e.target.checked,
                        expectedVersion: shelf.version,
                      })
                    }
                  />
                  {shelf.name}
                </label>
              ))}
            </fieldset>
          )}
          {active ? (
            <>
              <p>
                {active.state === "paused" ? "Paused" : "Currently reading"} · {active.position}
                {active.total ? ` / ${active.total}` : ""}{" "}
                {active.unit === "second" ? "seconds" : active.unit === "page" ? "pages" : "%"}
              </p>
              {active.total && (
                <progress
                  className="w-full"
                  aria-label="Reading progress"
                  value={active.position}
                  max={active.total}
                />
              )}
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run({
                    type: "progress",
                    key: crypto.randomUUID(),
                    sessionId: active.id,
                    expectedVersion: active.version,
                    position: value,
                    occurredAt: new Date().toISOString(),
                  });
                }}
              >
                <label className="text-sm">
                  Current position (
                  {active.unit === "second" ? "seconds" : active.unit === "page" ? "pages" : "%"})
                  <input
                    className={`${control} ml-2 w-28`}
                    required
                    type="number"
                    step={1}
                    min={active.position}
                    max={active.total ?? undefined}
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </label>
                <button
                  className={control}
                  disabled={
                    busy || active.state !== "active" || !position || !Number.isInteger(value)
                  }
                >
                  Log progress
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                {([active.state === "paused" ? "resume" : "pause", "finish", "dnf"] as const).map(
                  (action) => (
                    <button
                      key={action}
                      className={control}
                      disabled={busy}
                      onClick={() =>
                        run({
                          type: "transition",
                          key: crypto.randomUUID(),
                          sessionId: active.id,
                          expectedVersion: active.version,
                          action,
                          occurredAt: new Date().toISOString(),
                        })
                      }
                    >
                      {action === "dnf"
                        ? "Did not finish"
                        : action === "finish"
                          ? "Finish reading"
                          : action === "pause"
                            ? "Pause"
                            : "Resume"}
                    </button>
                  ),
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select
                className={control}
                aria-label="Progress unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as typeof unit)}
              >
                <option value="page">Pages</option>
                <option value="second">Audio seconds</option>
                <option value="percent">Percent</option>
              </select>
              <button
                className={control}
                disabled={busy}
                onClick={() =>
                  run({
                    type: "start",
                    key: crypto.randomUUID(),
                    userBookId: book.id,
                    expectedVersion: history.data!.userBookVersion,
                    unit,
                    position: 0,
                    startedAt: new Date().toISOString(),
                  })
                }
              >
                {history.data.sessions.length ? "Read again" : "Start reading"}
              </button>
            </div>
          )}
          <h3 className="font-medium">Reading history</h3>
          {!history.data.sessions.length && (
            <p className="text-sm text-muted-foreground">No reading sessions yet.</p>
          )}
          <ul className="space-y-3">
            {history.data.sessions.map((s) => (
              <li key={s.id} className="border-t border-border pt-3 text-sm">
                <p>
                  {s.state} ·{" "}
                  {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "Unknown start"}
                  {s.finishedAt ? ` — ${new Date(s.finishedAt).toLocaleDateString()}` : ""}
                </p>
                <ul className="mt-1 text-muted-foreground">
                  {history.data.entries
                    .filter((e) => e.sessionId === s.id)
                    .map((e) => (
                      <li key={e.id}>
                        {e.kind === "baseline" ? "Started at" : "Progress"}: {e.position} {s.unit} ·{" "}
                        {e.occurredAt ? new Date(e.occurredAt).toLocaleString() : "Unknown date"}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
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
