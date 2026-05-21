import { useEffect, useState } from "react";
import { searchBooks, type SearchResult } from "@/lib/open-library";
import { Loader2, Search, X, PenLine, Headphones, BookOpen, CalendarDays } from "lucide-react";
import { BookCover } from "./BookCover";

export type BookPickResult = SearchResult & {
  format?: "book" | "audiobook";
  durationMinutes?: number;
  status?: "reading" | "finished" | "wishlist";
  finishedAt?: string;
  addedAt?: string;
  extraReads?: string[];
};

export function BookSearch({
  onPick,
  onClose,
}: {
  onPick: (r: BookPickResult) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Manual entry state
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualFormat, setManualFormat] = useState<"book" | "audiobook">("book");
  const [manualPages, setManualPages] = useState("");
  const [manualDuration, setManualDuration] = useState("");
  const [manualCover, setManualCover] = useState("");
  const [manualStatus, setManualStatus] = useState<"reading" | "finished" | "wishlist">("reading");
  const [manualStarted, setManualStarted] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualFinished, setManualFinished] = useState(() => new Date().toISOString().split("T")[0]);
  const [rereadDates, setRereadDates] = useState<string[]>([]);

  // When picking from search, show date options
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [pickStatus, setPickStatus] = useState<"reading" | "finished" | "wishlist">("reading");
  const [pickStarted, setPickStarted] = useState(() => new Date().toISOString().split("T")[0]);
  const [pickFinished, setPickFinished] = useState(() => new Date().toISOString().split("T")[0]);
  const [pickFormat, setPickFormat] = useState<"book" | "audiobook">("book");

  useEffect(() => {
    if (tab !== "search" || !q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try { setResults(await searchBooks(q)); }
      catch { setErr("Couldn't reach the library. Try again."); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q, tab]);

  function confirmPick() {
    if (!picked) return;
    const finishedAt = pickStatus === "finished" ? new Date(pickFinished + "T12:00:00").toISOString() : undefined;
    const addedAt = new Date(pickStarted + "T12:00:00").toISOString();
    onPick({ ...picked, format: pickFormat, status: pickStatus, finishedAt, addedAt });
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    const durationMins = manualFormat === "audiobook" ? (manualDuration ? parseFloat(manualDuration) * 60 : undefined) : undefined;
    const finishedAt = manualStatus === "finished" ? new Date(manualFinished + "T12:00:00").toISOString() : undefined;
    const addedAt = new Date(manualStarted + "T12:00:00").toISOString();
    onPick({
      key: `manual-${Date.now()}`,
      title: manualTitle.trim(),
      author: manualAuthor.trim() || "Unknown",
      coverUrl: manualCover.trim() || undefined,
      totalPages: manualFormat === "book" && manualPages ? Number(manualPages) : undefined,
      source: "openlibrary",
      sourceUrl: "https://openlibrary.org/",
      format: manualFormat,
      durationMinutes: durationMins ? Math.round(durationMins) : undefined,
      status: manualStatus,
      finishedAt,
      addedAt,
      extraReads: rereadDates.map(d => new Date(d + "T12:00:00").toISOString()),
    });
  }

  const today = new Date().toISOString().split("T")[0];

  // If a search result was tapped, show confirm panel
  if (picked) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 border-b border-border flex items-center gap-2">
          <button onClick={() => setPicked(null)} className="p-2 -ml-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
          <p className="flex-1 text-sm font-medium truncate">{picked.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex gap-3 items-start">
            <BookCover book={picked} size="lg" />
            <div className="flex-1 min-w-0 pt-1">
              <p className="font-display text-lg leading-tight">{picked.title}</p>
              <p className="text-sm text-muted-foreground">{picked.author}</p>
              {picked.totalPages && <p className="text-xs text-muted-foreground/80 mt-1">{picked.totalPages} pages</p>}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Format</label>
            <div className="flex gap-2">
              {(["book", "audiobook"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPickFormat(f)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-medium border transition-colors ${pickFormat === f ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {f === "book" ? <BookOpen className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                  {f === "book" ? "Book" : "Audiobook"}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Add as</label>
            <div className="flex gap-1 p-1 bg-muted rounded-md">
              {(["reading", "finished", "wishlist"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPickStatus(s)}
                  className={`flex-1 text-xs py-1.5 rounded-sm capitalize font-medium ${pickStatus === s ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date added */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {pickStatus === "finished" ? "Started reading" : "Date added"}
            </label>
            <input
              type="date"
              value={pickStarted}
              onChange={(e) => setPickStarted(e.target.value)}
              max={today}
              className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
            />
          </div>

          {pickStatus === "finished" && (
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Finished on
              </label>
              <input
                type="date"
                value={pickFinished}
                onChange={(e) => setPickFinished(e.target.value)}
                max={today}
                className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
          )}

          <button
            onClick={confirmPick}
            className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90"
          >
            Add to library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-0 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          {tab === "search" && (
            <div className="flex-1 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus={tab === "search"}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title or author…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
          )}
          {tab === "manual" && (
            <p className="flex-1 text-sm font-medium px-1">Add custom book</p>
          )}
          <button onClick={onClose} aria-label="Close" className="p-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Tab bar */}
        <div className="flex">
          <button
            onClick={() => setTab("search")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === "search" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Search className="h-3.5 w-3.5" /> Search library
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <PenLine className="h-3.5 w-3.5" /> Add manually
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Search tab */}
        {tab === "search" && (
          <>
            {loading && <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {err && <p className="text-sm text-destructive py-4">{err}</p>}
            {!loading && !err && q && results.length === 0 && <p className="text-sm text-muted-foreground py-4">No results.</p>}
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.key}>
                  <button
                    onClick={() => { setPicked(r); setPickStatus("reading"); setPickStarted(today); setPickFinished(today); setPickFormat("book"); }}
                    className="w-full py-3 flex items-center gap-3 text-left hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors"
                  >
                    <BookCover book={r} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.author}</p>
                      {r.totalPages && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{r.totalPages} pages</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {!q && (
              <p className="text-xs text-muted-foreground/80 text-center mt-8 px-6">
                Search powered by Open Library.
              </p>
            )}
          </>
        )}

        {/* Manual entry tab */}
        {tab === "manual" && (
          <form onSubmit={submitManual} className="space-y-4 pt-1">
            {/* Format toggle */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Format</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualFormat("book")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-medium border transition-colors ${manualFormat === "book" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                >
                  <BookOpen className="h-4 w-4" /> Book
                </button>
                <button
                  type="button"
                  onClick={() => setManualFormat("audiobook")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-medium border transition-colors ${manualFormat === "audiobook" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                >
                  <Headphones className="h-4 w-4" /> Audiobook
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Title <span className="text-destructive">*</span></label>
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                required
                placeholder="Book title"
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Author</label>
              <input
                value={manualAuthor}
                onChange={(e) => setManualAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>

            {manualFormat === "book" ? (
              <div>
                <label className="text-xs text-muted-foreground">Page count</label>
                <input
                  value={manualPages}
                  onChange={(e) => setManualPages(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="e.g. 320"
                  className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-muted-foreground">Duration (hours)</label>
                <input
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 9.5"
                  className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Cover image URL (optional)</label>
              <input
                value={manualCover}
                onChange={(e) => setManualCover(e.target.value)}
                placeholder="https://…"
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground">Add as</label>
              <div className="flex gap-1 mt-1 p-1 bg-muted rounded-md">
                {(["reading", "finished", "wishlist"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setManualStatus(s)}
                    className={`flex-1 text-xs py-1.5 rounded-sm capitalize font-medium ${manualStatus === s ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Started date */}
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {manualStatus === "finished" ? "Started reading" : "Date added"}
              </label>
              <input
                type="date"
                value={manualStarted}
                onChange={(e) => setManualStarted(e.target.value)}
                max={today}
                className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>

            {/* Finish date — only shown for finished */}
            {manualStatus === "finished" && (
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Finished on
                </label>
                <input
                  type="date"
                  value={manualFinished}
                  onChange={(e) => setManualFinished(e.target.value)}
                  max={today}
                  className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none"
                />
              </div>
            )}

            {/* Additional re-reads — only for finished */}
            {manualStatus === "finished" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">Additional re-reads (optional)</label>
                  <button
                    type="button"
                    onClick={() => setRereadDates((d) => [...d, today])}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add re-read
                  </button>
                </div>
                {rereadDates.length > 0 && (
                  <div className="space-y-1.5">
                    {rereadDates.map((d, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="date"
                          value={d}
                          onChange={(e) => setRereadDates((arr) => arr.map((v, j) => j === i ? e.target.value : v))}
                          max={today}
                          className="flex-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setRereadDates((arr) => arr.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">First read uses the "Finished on" date above.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!manualTitle.trim()}
              className="w-full bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              Add to library
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
