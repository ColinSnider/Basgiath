import { BookCover } from "./BookCover";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Layers, ListOrdered, Pin } from "lucide-react";
import { rowanOrganization, rowanOrganizationMutate } from "@/lib/rowan-fns";
import type { OrganizationAction } from "../../../shared/reading-organization";

type Data = Awaited<ReturnType<typeof rowanOrganization>>;
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export function ReadingOrganization({
  sessionId,
  bookId,
  openBook,
  mode,
  seriesId,
}: {
  sessionId: string;
  bookId?: string;
  openBook: (book: { id: string }) => void;
  mode?: "series" | "queue";
  seriesId?: string;
}) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["rowan", sessionId, "organization"],
    queryFn: () => rowanOrganization({ data: { sessionId } }),
  });
  const pending = useRef<Parameters<typeof rowanOrganizationMutate>[0] | null>(null);
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: rowanOrganizationMutate,
    onSuccess: async (result) => {
      pending.current = null;
      setNotice(result.ok ? "Saved." : result.message);
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
    onError: () => setNotice("The save could not be confirmed. Retry safely below."),
  });
  function run(change: OrganizationAction) {
    if (!query.data || pending.current) return;
    pending.current = {
      data: {
        sessionId,
        command: { key: crypto.randomUUID(), expectedVersion: query.data.version, change },
      },
    };
    mutation.mutate(pending.current);
  }
  const [tab, setTab] = useState<"series" | "queue">("series");
  const activeTab = mode ?? tab;
  if (query.isPending) return <p role="status">Loading series and reading queue…</p>;
  if (query.isError)
    return (
      <p role="alert">
        Series could not load. <button onClick={() => void query.refetch()}>Retry</button>
      </p>
    );
  const data = query.data;
  const busy = mutation.isPending || !!pending.current;
  const queued = data.queue.find((r) => r.userBookId === bookId);
  const groups = bookId
    ? data.series.filter((s) =>
        data.members.some((m) => m.seriesId === s.id && m.userBookId === bookId),
      )
    : data.series.filter((s) => !seriesId || s.id === seriesId);
  return (
    <section className="rowan-organization space-y-5" aria-label="Series and reading queue">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">
            {bookId ? "In your reading life" : mode === "queue" ? "Manage reading queue" : mode === "series" ? "Manage series" : "Series & reading queue"}
          </h2>
        </div>
        {!bookId && !mode && (
          <div className="flex gap-2" aria-label="Reading organization views">
            <button
              className={control}
              aria-pressed={tab === "series"}
              onClick={() => setTab("series")}
            >
              <Layers size={16} /> Series
            </button>
            <button
              className={control}
              aria-pressed={tab === "queue"}
              onClick={() => setTab("queue")}
            >
              <ListOrdered size={16} /> Queue
            </button>
          </div>
        )}
      </header>
      <div role="status">
        {notice}
        {mutation.isError && (
          <button
            className={control}
            disabled={mutation.isPending}
            onClick={() => pending.current && mutation.mutate(pending.current)}
          >
            Retry save
          </button>
        )}
      </div>
      {bookId && (
        <div className="flex flex-wrap gap-2">
          <button
            className={control}
            disabled={busy}
            onClick={() => run({ action: queued ? "queueRemove" : "queueAdd", userBookId: bookId })}
          >
            {queued ? "Remove from queue" : "Add to reading queue"}
          </button>
          {queued && (
            <button
              className={control}
              disabled={busy}
              aria-pressed={queued.pinned}
              onClick={() =>
                run({ action: "queuePin", userBookId: bookId, pinned: !queued.pinned })
              }
            >
              <Pin size={15} /> {queued.pinned ? "Pinned to read next" : "Read this next"}
            </button>
          )}
          <MembershipForm data={data} bookId={bookId} busy={busy} run={run} />
        </div>
      )}
      {(bookId || activeTab === "series") && (
        <>
          {!groups.length && (
            <p className="text-muted-foreground">
              {bookId
                ? "This book isn’t in a series yet. Add it to one or create a series below."
                : "Keep a series in reading order, track the books you finish, and choose your next read."}
            </p>
          )}
          {groups.map((group) => (
            <SeriesCard
              key={group.id}
              group={group}
              data={data}
              run={run}
              busy={busy}
              openBook={openBook}
            />
          ))}
          <details>
            <summary className="cursor-pointer font-medium">Create a series</summary>
            <SeriesForm busy={busy} run={run} />
          </details>
        </>
      )}
      {!bookId && activeTab === "queue" && (
        <>
          <p className="text-muted-foreground">
            Your chosen reading order. Pin one book for Home’s next read. Started and finished books
            leave the upcoming list automatically.
          </p>
          <AddBook data={data} busy={busy} run={run} />
          {!data.queue.length && <p>Your queue is empty. Choose a book from your library.</p>}
          <ol className="space-y-3">
            {data.queue.map((entry, index) => {
              const book = data.books.find((b) => b.id === entry.userBookId)!;
              return (
                <li className="rowan-series-book" key={entry.userBookId}>
                  <BookLink book={book} openBook={openBook} />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={control}
                      disabled={busy}
                      aria-pressed={entry.pinned}
                      onClick={() =>
                        run({ action: "queuePin", userBookId: book.id, pinned: !entry.pinned })
                      }
                    >
                      {entry.pinned ? "Pinned next" : "Pin next"}
                    </button>
                    <button
                      className={control}
                      aria-label={`Move ${book.title} earlier`}
                      disabled={
                        busy || index === 0 || data.queue[index - 1]?.pinned || entry.pinned
                      }
                      onClick={() =>
                        run({ action: "queueMove", userBookId: book.id, direction: "up" })
                      }
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className={control}
                      aria-label={`Move ${book.title} later`}
                      disabled={busy || index === data.queue.length - 1 || entry.pinned}
                      onClick={() =>
                        run({ action: "queueMove", userBookId: book.id, direction: "down" })
                      }
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      className={control}
                      disabled={busy}
                      onClick={() => run({ action: "queueRemove", userBookId: book.id })}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
type Actions = { run: (action: OrganizationAction) => void; busy: boolean };
function BookLink({
  book,
  openBook,
}: {
  book: Data["books"][number];
  openBook: (book: { id: string }) => void;
}) {
  return (
    <button className="rowan-series-book-link" onClick={() => openBook(book)}>
      <BookCover title={book.title} authors={book.authors} src={book.coverUrl} className="rowan-cover-small" />
      <span>
        <strong>{book.title}</strong>
        <small>
          {book.authors.join(", ")} ·{" "}
          {
            (
              {
                read: "Finished",
                reading: "Reading",
                paused: "Paused",
                want_to_read: "Unread",
                dnf: "Did not finish",
              } as Record<string, string>
            )[book.status]
          }
        </small>
      </span>
    </button>
  );
}
function SeriesCard({
  group,
  data,
  busy,
  run,
  openBook,
}: Actions & {
  group: Data["series"][number];
  data: Data;
  openBook: (book: { id: string }) => void;
}) {
  const members = data.members.filter((m) => m.seriesId === group.id);
  const required = members.filter((m) => !m.optional);
  const completed = required.filter(
    (m) => data.books.find((b) => b.id === m.userBookId)?.completed,
  ).length;
  const next = required.find(
    (m) => data.books.find((b) => b.id === m.userBookId)?.status === "want_to_read",
  );
  return (
    <article className="rowan-series-card space-y-4">
      <header>
        <h3 className="font-display text-xl">{group.name}</h3>
        <p className="text-sm text-muted-foreground">
          {completed} of {required.length} tracked main books finished ·{" "}
          {group.completionState === "complete"
            ? "All volumes listed"
            : group.completionState === "open"
              ? "Ongoing series"
              : "Full series length unknown"}
        </p>
      </header>
      <progress
        className="rowan-series-progress"
        value={completed}
        max={Math.max(1, required.length)}
        aria-label={`${group.name}: ${completed} of ${required.length} tracked main books finished`}
      />
      {next && (
        <button
          className={control}
          disabled={busy}
          onClick={() => run({ action: "queueAdd", userBookId: next.userBookId })}
        >
          Queue next in series: {data.books.find((b) => b.id === next.userBookId)?.title}
        </button>
      )}
      <ol className="space-y-2">
        {members.map((m, i) => (
          <li key={m.id} className="rowan-series-book">
            <span className="rowan-series-number">
              {m.sequenceLabel || i + 1}
              {m.optional && <small>Optional</small>}
            </span>
            <BookLink book={data.books.find((b) => b.id === m.userBookId)!} openBook={openBook} />
            <div className="flex gap-2">
              <button
                className={control}
                disabled={busy || i === 0}
                aria-label={`Move book ${i + 1} earlier in ${group.name}`}
                onClick={() =>
                  run({
                    action: "seriesMove",
                    seriesId: group.id,
                    userBookId: m.userBookId,
                    direction: "up",
                  })
                }
              >
                <ArrowUp size={15} />
              </button>
              <button
                className={control}
                disabled={busy || i === members.length - 1}
                aria-label={`Move book ${i + 1} later in ${group.name}`}
                onClick={() =>
                  run({
                    action: "seriesMove",
                    seriesId: group.id,
                    userBookId: m.userBookId,
                    direction: "down",
                  })
                }
              >
                <ArrowDown size={15} />
              </button>
              <button
                className={control}
                disabled={busy}
                onClick={() =>
                  run({ action: "seriesRemoveBook", seriesId: group.id, userBookId: m.userBookId })
                }
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <details>
        <summary className="cursor-pointer">Manage series & books</summary>
        <div className="space-y-4 pt-4">
          <SeriesForm group={group} busy={busy} run={run} />
          <AddBook data={data} seriesId={group.id} busy={busy} run={run} />
          <p className="text-sm">{group.sourceNote}</p>
          <button
            className={control}
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Delete ${group.name}? Your books and reading history will stay in your library.`,
                )
              )
                run({ action: "seriesDelete", seriesId: group.id });
            }}
          >
            Delete series
          </button>
        </div>
      </details>
    </article>
  );
}
function SeriesForm({ group, busy, run }: Actions & { group?: Data["series"][number] }) {
  return (
    <form
      className="flex flex-wrap gap-3 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run({
          action: "seriesSave",
          seriesId: group?.id ?? crypto.randomUUID(),
          name: String(f.get("name")),
          completionState: String(f.get("state")) as "unknown" | "open" | "complete",
          sourceNote: String(f.get("note")) || "Personal reading order",
        });
      }}
    >
      <label>
        Series name
        <input
          className={control}
          name="name"
          required
          maxLength={120}
          defaultValue={group?.name}
        />
      </label>
      <label>
        Series coverage
        <select className={control} name="state" defaultValue={group?.completionState ?? "unknown"}>
          <option value="unknown">Full length unknown</option>
          <option value="open">Ongoing series</option>
          <option value="complete">All volumes listed</option>
        </select>
      </label>
      <label>
        Order notes
        <input
          className={control}
          name="note"
          maxLength={1000}
          defaultValue={group?.sourceNote}
          placeholder="Publication order, author’s website…"
        />
      </label>
      <button className={control} disabled={busy}>
        {group ? "Save series" : "Create series"}
      </button>
    </form>
  );
}
function AddBook({ data, seriesId, busy, run }: Actions & { data: Data; seriesId?: string }) {
  const [search, setSearch] = useState("");
  const choices = data.books.filter(
    (b) =>
      `${b.title} ${b.authors.join(" ")}`.toLowerCase().includes(search.toLowerCase()) &&
      (seriesId ||
        (["want_to_read", "read"].includes(b.status) &&
          !data.queue.some((q) => q.userBookId === b.id))),
  );
  return (
    <form
      className="flex flex-wrap gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const userBookId = String(f.get("book"));
        if (!userBookId) return;
        run(
          seriesId
            ? {
                action: "seriesBook",
                seriesId,
                userBookId,
                sequenceLabel: String(f.get("sequence")),
                optional: f.get("optional") === "on",
              }
            : { action: "queueAdd", userBookId },
        );
      }}
    >
      <input
        className={control}
        aria-label="Filter books to add"
        placeholder="Find a library book…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select className={control} name="book" required aria-label="Library book" key={search}>
        <option value="">Choose a book</option>
        {choices.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
          </option>
        ))}
      </select>
      {seriesId && (
        <>
          <input
            className={control}
            name="sequence"
            aria-label="Book number"
            placeholder="Book number (e.g. 2.5)"
            maxLength={40}
          />
          <label>
            <input type="checkbox" name="optional" /> Optional / novella
          </label>
        </>
      )}
      <button className={control} disabled={busy || !choices.length}>
        {seriesId ? "Add / update book" : "Add to queue"}
      </button>
    </form>
  );
}
function MembershipForm({ data, bookId, busy, run }: Actions & { data: Data; bookId: string }) {
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run({
          action: "seriesBook",
          seriesId: String(f.get("series")),
          userBookId: bookId,
          sequenceLabel: String(f.get("sequence")),
          optional: f.get("optional") === "on",
        });
      }}
    >
      <select className={control} name="series" required aria-label="Series">
        <option value="">Choose a series</option>
        {data.series.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        className={control}
        name="sequence"
        placeholder="Book number"
        aria-label="Book number in series"
        maxLength={40}
      />
      <label>
        <input type="checkbox" name="optional" /> Optional
      </label>
      <button className={control} disabled={busy || !data.series.length}>
        Add / update series
      </button>
    </form>
  );
}
