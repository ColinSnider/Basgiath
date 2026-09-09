import { ArrowLeft, BookOpen, Heart, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookEditor } from "./BookEditor";
import { EditionForm } from "./EditionForm";
import { Margins } from "./Margins";
import {
  rowanHistory,
  type rowanLibrary,
  type rowanShelves,
  type RowanCommand,
} from "@/lib/rowan-fns";
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
type Item = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];
export function ReadingPanel({
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
      className="rowan-book-page"
      aria-label={`Reading details for ${book.title}`}
    >
      <button className="rowan-book-back" onClick={close}>
        <ArrowLeft size={17} /> Back to your reading life
      </button>
      <header className="rowan-book-hero">
        <div className="rowan-book-cover">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
          <BookOpen size={54} strokeWidth={1} aria-hidden="true" />
        </div>
        <div className="rowan-book-intro">
          <p className="rowan-eyebrow">Between the covers</p>
          <h2>{book.title}</h2>
          <p className="rowan-book-author">{book.authors.join(", ") || "Unknown author"}</p>
          <div className="rowan-book-badges">
            <span>
              {(
                {
                  reading: "Currently reading",
                  paused: "On pause",
                  read: "Finished",
                  want_to_read: "On your reading list",
                  dnf: "Did not finish",
                } as Record<string, string>
              )[book.status] || "In your library"}
            </span>
            {history.data?.isFavorite && (
              <span>
                <Heart size={14} fill="currentColor" /> A favorite
              </span>
            )}
            {history.data?.halfStars != null && (
              <span>
                <Star size={14} fill="currentColor" /> {history.data.halfStars / 2} / 5
              </span>
            )}
          </div>
          {active && (
            <div className="rowan-hero-progress">
              <p>
                {active.position}
                {active.total ? ` of ${active.total}` : ""}{" "}
                {active.unit === "page" ? "pages" : active.unit === "second" ? "seconds" : "%"}
                {active.total ? (
                  <strong>
                    {Math.min(100, Math.round((active.position / active.total) * 100))}%
                  </strong>
                ) : null}
              </p>
              {active.total ? (
                <progress aria-label="Book progress" value={active.position} max={active.total} />
              ) : null}
            </div>
          )}
        </div>
      </header>
      <div className="rowan-book-content space-y-5">
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
              <TagEditor book={book} history={history.data} busy={busy} run={run} />
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
            <section className="rowan-reading-controls space-y-4">
              <h3 className="font-display text-2xl">Your reading journey</h3>
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
                      {active.unit === "second"
                        ? "seconds"
                        : active.unit === "page"
                          ? "pages"
                          : "%"}
                      )
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
                    {(
                      [active.state === "paused" ? "resume" : "pause", "finish", "dnf"] as const
                    ).map((action) => (
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
                    ))}
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
                            {e.kind === "baseline" ? "Started at" : "Progress"}: {e.position}{" "}
                            {s.unit} ·{" "}
                            {e.occurredAt
                              ? new Date(e.occurredAt).toLocaleString()
                              : "Unknown date"}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
            <BookEditor
              key={`edit:${history.data.userBookVersion}`}
              sessionId={sessionId}
              book={book}
              history={history.data}
              close={close}
            />
            <EditionForm
              key={history.data.userBookVersion}
              userBookId={book.id}
              history={history.data}
              run={run}
              busy={busy}
            />
            <Margins margins={history.data.margins} userBookId={book.id} busy={busy} run={run} />
          </>
        )}
      </div>
    </section>
  );
}

function TagEditor({
  book,
  history,
  busy,
  run,
}: {
  book: Item;
  history: Awaited<ReturnType<typeof rowanHistory>>;
  busy: boolean;
  run: (command: RowanCommand) => void;
}) {
  const [value, setValue] = useState(history.tags.join(", "));
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        run({
          type: "personalize",
          key: crypto.randomUUID(),
          userBookId: book.id,
          expectedVersion: history.userBookVersion,
          tags: value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        });
      }}
    >
      <label className="text-sm">
        Tags{" "}
        <input
          className={control}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="fantasy, reread"
          maxLength={500}
        />
      </label>
      <button className={control} disabled={busy}>
        Save tags
      </button>
    </form>
  );
}
