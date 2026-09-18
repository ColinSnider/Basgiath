import { useState } from "react";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { rowanSearch, type rowanHistory } from "@/lib/rowan-fns";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, Pencil, Trash2 } from "lucide-react";
import { BookCover } from "./BookCover";
import { metadataSchema } from "../../../shared/rowan-archive";
import { useAccountMutation } from "./useAccountMutation";
import { useReadingCommands } from "../../../apps/rowan/components/reader";

const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export function BookEditor({
  sessionId,
  book,
  history,
  close,
}: {
  sessionId: string;
  book: { id: string; title: string; authors: string[]; coverUrl: string | null };
  history: Awaited<ReturnType<typeof rowanHistory>>;
  close: () => void;
}) {
  const edit = useAccountMutation(sessionId, () => setDirty(false));
  const deletion = useAccountMutation(sessionId, close);
  const { run: runSync, busy: syncing, feedback: syncFeedback } = useReadingCommands();
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  const [lookup, setLookup] = useState(false);
  const [searchText, setSearchText] = useState(
    `${book.title} ${book.authors[0] ?? ""}`.trim().slice(0, 200),
  );
  const [searchTerm, setSearchTerm] = useState(searchText);
  const [source, setSource] = useState<"googlebooks" | "openlibrary">("googlebooks");
  const [selected, setSelected] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const matches = useQuery({
    queryKey: ["rowan", sessionId, "sync-matches", source, searchTerm],
    enabled: lookup && !!searchTerm,
    retry: false,
    queryFn: () =>
      rowanSearch({ data: { sessionId, query: searchTerm, source, includeExtras: true } }),
  });
  const busy = edit.busy || deletion.busy || syncing;
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer">
        <Pencil className="inline mr-2" size={16} aria-hidden="true" />
        Edit book details
      </summary>
      <form
        className="mt-4 grid gap-3"
        onChange={() => setDirty(true)}
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const fields = new FormData(event.currentTarget);
          try {
            const metadata = metadataSchema.parse({ ...history.metadata });
            metadata.description = String(fields.get("description")).trim();
            edit.run({
              type: "editBook",
              key: crypto.randomUUID(),
              userBookId: book.id,
              expectedVersion: history.userBookVersion,
              title: String(fields.get("title")),
              authors: String(fields.get("authors"))
                .split("\n")
                .map((a) => a.trim())
                .filter(Boolean),
              coverUrl: String(fields.get("coverUrl")).trim() || null,
              metadata,
            });
          } catch {
            setError("Metadata must be a valid JSON object.");
          }
        }}
      >
        <label className="grid gap-1">
          Title
          <input
            className={control}
            name="title"
            defaultValue={book.title}
            required
            maxLength={500}
          />
        </label>
        <label className="grid gap-1">
          Authors (one per line)
          <textarea className={control} name="authors" defaultValue={book.authors.join("\n")} />
        </label>
        <label className="grid gap-1">
          Cover URL
          <input
            className={control}
            name="coverUrl"
            type="url"
            defaultValue={book.coverUrl ?? ""}
          />
        </label>
        <label className="grid gap-1">
          About this book
          <textarea
            className={control}
            name="description"
            rows={5}
            maxLength={10000}
            defaultValue={
              typeof history.metadata.description === "string" ? history.metadata.description : ""
            }
            placeholder="Synopsis or your own description"
          />
        </label>
        <button className={control} disabled={busy}>
          Save book details
        </button>
      </form>
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
        <h4 className="font-medium">Catalog details</h4>
        <p className="text-sm text-muted-foreground">
          Refresh title, author, cover, and synopsis from Google Books or Open Library. Your saved
          page count and reading history stay unchanged.
        </p>
        <button
          type="button"
          className={control}
          disabled={busy}
          onClick={() => setLookup(!lookup)}
        >
          <RefreshCw size={16} className="inline mr-2" aria-hidden="true" />
          Find updated book details
        </button>
        {lookup && (
          <div className="mt-3 space-y-3">
            <p className="text-sm">
              Choose the matching book to refresh its details. Try just the title if no matches
              appear.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSearchTerm(searchText.trim());
                setSelected(null);
                setLanguage("");
                setSource("googlebooks");
                if (source === "googlebooks" && searchTerm === searchText.trim())
                  void matches.refetch();
              }}
            >
              <input
                className={`${control} min-w-0 flex-1`}
                aria-label="Book title, author, or ISBN"
                placeholder="Search title, author, or ISBN"
                value={searchText}
                maxLength={200}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <button
                className={control}
                disabled={!searchText.trim() || matches.isFetching || busy}
              >
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Search Google Books</span>
              </button>
            </form>
            <p className="text-sm text-muted-foreground">
              Matches from {source === "googlebooks" ? "Google Books" : "Open Library"}
            </p>
            <button
              type="button"
              className={control}
              disabled={busy}
              onClick={() => { setSource(source === "googlebooks" ? "openlibrary" : "googlebooks"); setSelected(null); setLanguage(""); }}
            >
              {source === "googlebooks" ? "Search more on Open Library" : "Back to Google Books"}
            </button>
            {matches.isFetching && <p role="status">Finding matches…</p>}
            {matches.isError && (
              <p role="alert">
                {matches.error.message || "Matches could not load."}{" "}
                <button onClick={() => void matches.refetch()}>Retry</button>
              </p>
            )}
            {matches.data?.length === 0 && (
              <p>No matches. Try a shorter title or remove the author.</p>
            )}
            {!!matches.data?.length && <label className="flex items-center gap-2 text-sm">
              Language
              <select className={control} value={language} onChange={(e) => { setLanguage(e.target.value); setSelected(null); }}>
                <option value="">All languages</option>
                {[...new Set(matches.data.map((result) => result.language).filter((value): value is string => !!value))].sort().map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <span className="text-muted-foreground">{matches.data.filter((result) => !language || result.language === language).length} matches</span>
            </label>}
            <ul className="grid gap-3">
              {matches.data?.filter((result) => !language || result.language === language).map((result) => (
                <li key={result.ref.externalId} className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-start gap-4 p-4 text-left disabled:opacity-50"
                    disabled={busy}
                    aria-expanded={selected === result.ref.externalId}
                    onClick={() => setSelected(selected === result.ref.externalId ? null : result.ref.externalId)}
                  >
                    <BookCover
                      title={result.title}
                      authors={result.authors}
                      src={result.coverUrl}
                      className="rowan-cover-small"
                    />
                    <span className="min-w-0">
                      <strong className="block">{result.title}</strong>
                      <span className="block text-sm text-muted-foreground">
                        {result.authors.join(", ")}
                      </span>
                      <span className="block mt-2 text-sm text-muted-foreground">
                        {[result.publisher, result.publishedDate, result.language?.toUpperCase(), result.pageCount ? `${result.pageCount} pages` : null].filter(Boolean).join(" · ") || "Publication details unavailable"}
                      </span>
                      {!!result.isbns?.length && <span className="block text-xs text-muted-foreground break-all">ISBN {result.isbns.join(" / ")}</span>}
                      <span className="block mt-2 text-sm text-primary">{selected === result.ref.externalId ? "Hide edition" : "Review this edition"}</span>
                    </span>
                  </button>
                  {selected === result.ref.externalId && <div className="border-t border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-sm">Use this edition’s title, author, cover, and available synopsis. Your saved page count, dates, and reading history will stay unchanged.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={control} disabled={busy} onClick={() => runSync({ type: "syncCatalog", key: crypto.randomUUID(), userBookId: book.id, expectedVersion: history.userBookVersion, source: result.ref.provider, externalId: result.ref.externalId })}>{syncing ? "Updating…" : "Use this edition"}</button>
                      <button type="button" className={control} disabled={busy || matches.isFetching} onClick={() => {
                        const query = `intitle:"${result.title.split(":")[0].replaceAll('"', '')}"${result.authors[0] ? ` inauthor:"${result.authors[0].replaceAll('"', '')}"` : ""}`.slice(0, 200);
                        setSearchText(query); setSearchTerm(query); setSource("googlebooks"); setLanguage(""); setSelected(null);
                      }}>Find other editions</button>
                    </div>
                  </div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {syncFeedback}
      </div>
      <p role="status">{error || edit.message || deletion.message}</p>
      {edit.uncertain && (
        <button className={control} onClick={edit.retry}>
          Retry save
        </button>
      )}
      {deletion.uncertain && (
        <button className={control} onClick={deletion.retry}>
          Retry deletion
        </button>
      )}
      <button
        className={`${control} mt-4 text-destructive`}
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              `Permanently delete “${book.title}” and its reading history and margins from Rowan? The legacy copy remains, but will not be imported again automatically.`,
            )
          )
            deletion.run({
              type: "deleteBook",
              key: crypto.randomUUID(),
              userBookId: book.id,
              expectedVersion: history.userBookVersion,
            });
        }}
      >
        <Trash2 size={16} className="inline mr-2" aria-hidden="true" />
        Delete book permanently
      </button>
    </details>
  );
}
