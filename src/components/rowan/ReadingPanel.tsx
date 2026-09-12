import { BookCover } from "./BookCover";
import { ReadingTimer } from "./ReadingTimer";
import { HistoryEditor } from "./HistoryEditor";
import { ArrowLeft, BookOpen, Heart, NotebookPen, History, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookEditor } from "./BookEditor";
import { EditionForm } from "./EditionForm";
import { Margins } from "./Margins";
import { ReadingProgressBar } from "./ReadingProgressBar";
import {
  rowanHistory,
  type rowanLibrary,
  type rowanShelves,
  type RowanCommand,
} from "@/lib/rowan-fns";
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
type Item = Awaited<ReturnType<typeof rowanLibrary>>["items"][number];

type CoverPalette = { accent: string; deep: string; glow: string };
const defaultPalette: CoverPalette = {
  accent: "#5a1a25",
  deep: "#241016",
  glow: "rgba(183, 110, 121, .6)",
};

function useCoverPalette(coverUrl: string | null) {
  const [palette, setPalette] = useState(defaultPalette);
  useEffect(() => {
    if (!coverUrl || typeof window === "undefined") {
      setPalette(defaultPalette);
      return;
    }
    setPalette(defaultPalette);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 12;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(image, 0, 0, 12, 12);
        const pixels = context.getImageData(0, 0, 12, 12).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 180) continue;
          r += pixels[index];
          g += pixels[index + 1];
          b += pixels[index + 2];
          count++;
        }
        if (!count) return;
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        setPalette({
          accent: `rgb(${r}, ${g}, ${b})`,
          deep: `rgb(${Math.round(r * 0.38)}, ${Math.round(g * 0.38)}, ${Math.round(b * 0.38)})`,
          glow: `rgba(${r}, ${g}, ${b}, .72)`,
        });
      } catch {
        // Cover hosts may block canvas reads; the Rowan palette remains usable.
      }
    };
    image.src = coverUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [coverUrl]);
  return palette;
}

export function ReadingPanel({
  book,
  sessionId,
  busy,
  run,
  close,
  shelves,
  organization,
}: {
  organization?: React.ReactNode;
  book: Item;
  sessionId: string;
  busy: boolean;
  run: (command: RowanCommand) => void;
  close: () => void;
  shelves: Awaited<ReturnType<typeof rowanShelves>>;
}) {
  const [unit, setUnit] = useState<"page" | "second" | "percent">("page");
  const [position, setPosition] = useState("");
  const [tab, setTab] = useState<"reading" | "margins" | "history" | "details">("reading");
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
  const palette = useCoverPalette(book.coverUrl);
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
      <header
        className="rowan-book-hero"
        style={
          {
            "--book-accent": palette.accent,
            "--book-deep": palette.deep,
            "--book-glow": palette.glow,
          } as CSSProperties
        }
      >
        {book.coverUrl && (
          <img
            className="rowan-book-backdrop"
            src={book.coverUrl}
            alt=""
            aria-hidden="true"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
        <BookCover
          title={book.title}
          authors={book.authors}
          src={book.coverUrl}
          className="rowan-cover-hero"
        />
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
          </div>
          {history.data && (
            <dl className="rowan-book-facts">
              <div>
                <dt>Edition</dt>
                <dd>
                  {
                    (
                      {
                        book: "Print",
                        ebook: "Ebook",
                        audiobook: "Audio",
                        unknown: "Unspecified",
                      } as Record<string, string>
                    )[history.data.edition?.format ?? "unknown"]
                  }
                </dd>
              </div>
              {history.data.edition?.pageCount && (
                <div>
                  <dt>Length</dt>
                  <dd>{history.data.edition.pageCount} pages</dd>
                </div>
              )}
              {history.data.edition?.durationSeconds && (
                <div>
                  <dt>Listening time</dt>
                  <dd>
                    {Math.floor(history.data.edition.durationSeconds / 3600)}h{" "}
                    {Math.round((history.data.edition.durationSeconds % 3600) / 60)}m
                  </dd>
                </div>
              )}
              <div>
                <dt>Completed reads</dt>
                <dd>{history.data.sessions.filter((s) => s.state === "completed").length}</dd>
              </div>
              <div>
                <dt>Margins</dt>
                <dd>{history.data.margins.length}</dd>
              </div>
            </dl>
          )}
          {active && <ReadingProgressBar progress={active} />}
        </div>
      </header>
      <div className="rowan-book-content rowan-book-record">
        <nav className="rowan-record-tabs" aria-label="Book record">
          {(
            [
              { id: "reading", label: "Reading", icon: BookOpen },
              { id: "margins", label: "Margins", icon: NotebookPen },
              { id: "history", label: "History", icon: History },
              { id: "details", label: "Details", icon: Info },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
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
            <div className="rowan-record-summary">
              <div>
                <span className="rowan-eyebrow">Your copy</span>
                <p>
                  {active
                    ? active.state === "paused"
                      ? "Ready when you are."
                      : "A little further, every day."
                    : book.status === "read"
                      ? "One for the memories."
                      : "Your next chapter starts here."}
                </p>
              </div>
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
            </div>
            {tab === "details" && shelves.length > 0 && (
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
            {tab === "reading" && (
              <div className="rowan-reading-desk">
                <section className="rowan-reading-controls rowan-record-card space-y-4">
                  <span className="rowan-eyebrow">
                    <BookOpen size={15} /> Your bookmark
                  </span>
                  <h3 className="font-display text-2xl">
                    {active ? "Where are you now?" : "Make time for a story"}
                  </h3>
                  {active ? (
                    <>
                      <ReadingProgressBar progress={active} />
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
                          className="reader-button"
                          disabled={
                            busy ||
                            active.state !== "active" ||
                            !position ||
                            !Number.isInteger(value)
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
                            className={action === "finish" ? "reader-button" : control}
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
                        className="reader-button"
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
                </section>
                <ReadingTimer sessions={history.data.sessions} run={run} busy={busy} />
              </div>
            )}
            {tab === "history" && (
              <section className="rowan-record-card">
                <HistoryEditor userBookId={book.id} history={history.data} busy={busy} run={run} />
              </section>
            )}
            {tab === "margins" && (
              <section className="rowan-book-margins" aria-label="Book margins">
                <Margins
                  margins={history.data.margins}
                  userBookId={book.id}
                  busy={busy}
                  run={run}
                />
              </section>
            )}
            {tab === "details" && (
              <div className="rowan-record-details">
                <section className="rowan-record-card">
                  <h3 className="font-display text-2xl">About this book</h3>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {typeof history.data.metadata.description === "string" &&
                    history.data.metadata.description.trim()
                      ? history.data.metadata.description
                      : "No synopsis yet. You can add one in book details below."}
                  </p>
                </section>
                {organization}
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
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
