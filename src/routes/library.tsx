import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads, lastReadDate } from "@/lib/basgiath-store";
import { useMemo, useState } from "react";
import { BookSearch } from "@/components/BookSearch";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: Library,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Library() {
  const { books, addBook } = useStore();
  const [tab, setTab] = useState<"year" | "all">("year");
  const [searching, setSearching] = useState(false);
  const year = new Date().getFullYear();

  const byYear = useMemo(() => {
    const map = new Map<number, number>();
    books.forEach((b) => b.reads.forEach((r) => {
      const y = new Date(r.finishedAt).getFullYear();
      map.set(y, (map.get(y) ?? 0) + 1);
    }));
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [books]);

  const thisYearBooks = books
    .map((b) => ({ b, count: readsInYear(b, year) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const allBooks = [...books].sort((a, b) => {
    const la = lastReadDate(a);
    const lb = lastReadDate(b);
    if (la && lb) return lb.localeCompare(la);
    if (la) return -1;
    if (lb) return 1;
    return b.addedAt.localeCompare(a.addedAt);
  });

  return (
    <>
      <AppHeader title="Library" subtitle="Your reading history." />

      <div className="px-5">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["year", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "year" ? `${year}` : "All books"}
            </button>
          ))}
        </div>
      </div>

      {tab === "year" ? (
        <section className="px-5 mt-5">
          {byYear.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-5 px-5 mb-2">
              {byYear.map(([y, n]) => (
                <div
                  key={y}
                  className={`shrink-0 rounded-lg border px-3 py-2 ${
                    y === year ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <p className="text-[11px] text-muted-foreground">{y}</p>
                  <p className="font-display text-lg leading-none mt-0.5">{n}</p>
                </div>
              ))}
            </div>
          )}

          {thisYearBooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No books finished in {year} yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {thisYearBooks.map(({ b, count }) => (
                <li key={b.id}>
                  <Link
                    to="/book/$id"
                    params={{ id: b.id }}
                    className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"
                  >
                    <BookCover book={b} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                    </div>
                    {count > 1 && (
                      <span className="text-[11px] font-semibold bg-gold/25 text-primary px-2 py-1 rounded-full">
                        ×{count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="px-5 mt-5">
          {allBooks.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">Your library is empty.</p>
              <button
                onClick={() => setSearching(true)}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                <Plus className="h-4 w-4" /> Add a book
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {allBooks.map((b) => {
                const last = lastReadDate(b);
                const reReads = Math.max(0, totalReads(b) - 1);
                return (
                  <li key={b.id}>
                    <Link
                      to="/book/$id"
                      params={{ id: b.id }}
                      className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"
                    >
                      <BookCover book={b} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{b.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                        <p className="text-[11px] text-muted-foreground/80 mt-1">
                          {last ? `Last read ${formatDate(last)}` : "Not yet finished"}
                          {reReads > 0 && ` · ${reReads} re-read${reReads > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {searching && (
        <BookSearch
          onClose={() => setSearching(false)}
          onPick={(r) => {
            addBook({
              title: r.title,
              author: r.author,
              coverUrl: r.coverUrl,
              totalPages: r.totalPages,
              currentPage: 0,
              format: (r as any).format ?? "book",
              durationMinutes: (r as any).durationMinutes,
            });
            setSearching(false);
          }}
        />
      )}
    </>
  );
}
