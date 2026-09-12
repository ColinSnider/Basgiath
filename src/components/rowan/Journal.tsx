import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanJournal, rowanLibrary, rowanHistory } from "@/lib/rowan-fns";
import { MarginCard, MarginEditor } from "./Margins";
import { useReadingCommands } from "../../../apps/rowan/components/reader";
import { marginsMarkdown } from "./margins-markdown";
type Book = Awaited<ReturnType<typeof rowanJournal>>["items"][number]["book"];
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export function Journal({
  sessionId,
  openBook,
}: {
  sessionId: string;
  openBook: (book: Book) => void;
}) {
  const { run, busy, feedback } = useReadingCommands();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [bookId, setBookId] = useState("");
  const [kind, setKind] = useState<"" | "note" | "quote">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [composing, setComposing] = useState(false);
  const [draftBook, setDraftBook] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const end = to ? new Date(`${to}T00:00:00`) : null;
  if (end) end.setDate(end.getDate() + 1);
  const filters = {
    query: term,
    userBookId: bookId || undefined,
    kind: kind || undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: end?.toISOString(),
  };
  const invalidDates = !!(from && to && from > to);
  const query = useQuery({
    queryKey: ["rowan", sessionId, "journal", filters, offset],
    queryFn: () => rowanJournal({ data: { sessionId, ...filters, offset } }),
    enabled: !invalidDates,
  });
  const books = useQuery({
    queryKey: ["rowan", sessionId, "margin-books"],
    queryFn: async () => {
      const items: Awaited<ReturnType<typeof rowanLibrary>>["items"] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page: Awaited<ReturnType<typeof rowanLibrary>> = await rowanLibrary({
          data: { sessionId, offset, query: "", status: "all", sort: "title" },
        });
        items.push(...page.items);
        offset = page.nextOffset;
      }
      return items;
    },
  });
  const draftHistory = useQuery({
    queryKey: ["rowan", sessionId, "history", draftBook],
    queryFn: () => rowanHistory({ data: { sessionId, userBookId: draftBook } }),
    enabled: composing && !!draftBook,
  });
  async function download() {
    setExporting(true);
    setExportError("");
    try {
      const items: Awaited<ReturnType<typeof rowanJournal>>["items"] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page: Awaited<ReturnType<typeof rowanJournal>> = await rowanJournal({
          data: { sessionId, ...filters, offset },
        });
        items.push(...page.items);
        offset = page.nextOffset;
      }
      const url = URL.createObjectURL(
        new Blob([marginsMarkdown(items)], { type: "text/markdown;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "rowan-margins.md";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError("Export could not finish. Please try again.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <section id="journal" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Your margins</h2>
          <p className="text-muted-foreground">Your private reading memories, newest first.</p>
        </div>
        <div className="flex gap-2">
          <button className={control} onClick={() => setComposing(!composing)}>
            {composing ? "Hide draft" : "Write a margin"}
          </button>
          <button
            className={control}
            disabled={exporting || invalidDates || term !== search}
            onClick={() => void download()}
          >
            {exporting ? "Exporting…" : "Export Markdown"}
          </button>
        </div>
      </div>
      {feedback}
      {exportError && <p role="alert">{exportError}</p>}
      <div hidden={!composing} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <label className="block text-sm">
          Book
          <select
            className={`${control} block w-full`}
            value={draftBook}
            disabled={busy || !!draftBook}
            onChange={(e) => setDraftBook(e.target.value)}
          >
            <option value="">Choose a book</option>
            {books.data?.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </label>
        {draftBook && (
          <>
            <MarginEditor
              key={draftBook}
              userBookId={draftBook}
              run={run}
              busy={busy || draftHistory.isPending || draftHistory.isError}
              savedIds={draftHistory.data?.margins.map((m) => m.id)}
            />
            <button
              className={control}
              disabled={busy}
              onClick={() => {
                if (window.confirm("Change books and discard any unsaved text?")) setDraftBook("");
              }}
            >
              Change book
            </button>
          </>
        )}
        {draftHistory.isError && (
          <p role="alert">
            Book could not load. <button onClick={() => void draftHistory.refetch()}>Retry</button>
          </p>
        )}
      </div>
      {books.isError && (
        <p role="alert">
          Book choices could not load. <button onClick={() => void books.refetch()}>Retry</button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search margins"
          placeholder="Find a thought or book"
          maxLength={200}
          className={`${control} w-full`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by book"
          className={`${control} max-w-full`}
          value={bookId}
          onChange={(e) => {
            setBookId(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All books</option>
          {books.data?.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          className={control}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setOffset(0);
          }}
        >
          <option value="">Notes & quotes</option>
          <option value="note">Notes</option>
          <option value="quote">Quotes</option>
        </select>
        <label className="text-sm">
          From{" "}
          <input
            className={control}
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label className="text-sm">
          Through{" "}
          <input
            className={control}
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <button
          className={control}
          onClick={() => {
            setSearch("");
            setTerm("");
            setBookId("");
            setKind("");
            setFrom("");
            setTo("");
            setOffset(0);
          }}
        >
          Clear filters
        </button>
      </div>
      {invalidDates ? (
        <p role="alert">End date must be on or after the start date.</p>
      ) : (
        <>
          {query.isPending && <p role="status">Loading margins…</p>}
          {query.isError && (
            <p role="alert">
              Margins could not load. <button onClick={() => void query.refetch()}>Retry</button>
            </p>
          )}
          {query.data?.items.length === 0 && (
            <p>No margins match. Write a margin or clear your filters.</p>
          )}
          <ul className="space-y-4">
            {query.data?.items.map((margin) => (
              <li key={margin.id} className="space-y-2">
                <button
                  className="font-display text-xl underline"
                  onClick={() => openBook(margin.book)}
                >
                  {margin.book.title}
                </button>
                <ul>
                  <MarginCard margin={margin} userBookId={margin.book.id} run={run} busy={busy} />
                </ul>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              className={control}
              disabled={!offset || query.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 24))}
            >
              Previous
            </button>
            <button
              className={control}
              disabled={query.data?.nextOffset == null || query.isFetching}
              onClick={() => setOffset(query.data!.nextOffset!)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
