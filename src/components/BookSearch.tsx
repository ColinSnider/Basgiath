import { useEffect, useState } from "react";
import { searchBooks, type SearchResult } from "@/lib/open-library";
import { Loader2, Search, X } from "lucide-react";
import { BookCover } from "./BookCover";

export function BookSearch({
  onPick,
  onClose,
}: {
  onPick: (r: SearchResult) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        setResults(await searchBooks(q));
      } catch {
        setErr("Couldn't reach the library. Try again.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 border-b border-border flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-md bg-muted px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or author…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <button onClick={onClose} aria-label="Close" className="p-2 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {err && <p className="text-sm text-destructive py-4">{err}</p>}
        {!loading && !err && q && results.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No results.</p>
        )}
        <ul className="divide-y divide-border">
          {results.map((r) => (
            <li key={r.key}>
              <button
                onClick={() => onPick(r)}
                className="w-full py-3 flex items-center gap-3 text-left hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors"
              >
                <BookCover book={r} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.author}</p>
                  {r.totalPages && (
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">{r.totalPages} pages</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
        {!q && (
          <p className="text-xs text-muted-foreground/80 text-center mt-8 px-6">
            Search powered by Open Library. Kindle library import isn't available — Amazon doesn't expose a public API for personal libraries.
          </p>
        )}
      </div>
    </div>
  );
}
