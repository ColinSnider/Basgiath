import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads } from "@/lib/basgiath-store";
import { BookOpen, Sparkles, Plus } from "lucide-react";
import { useState } from "react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { books, goals, addBook } = useStore();
  const [searching, setSearching] = useState(false);
  const year = new Date().getFullYear();

  const reading = books.filter((b) => b.status === "reading");
  const finishedThisYear = books.reduce((sum, b) => sum + readsInYear(b, year), 0);
  const totalAllReads = books.reduce((sum, b) => sum + totalReads(b), 0);

  const primaryGoal = goals[0];
  const progress =
    primaryGoal && primaryGoal.metric === "books"
      ? Math.min(100, Math.round((finishedThisYear / primaryGoal.target) * 100))
      : null;

  return (
    <>
      <AppHeader title="Basgiath" subtitle="Welcome back, reader." />

      <section className="px-5">
        <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-5 shadow-lg ring-1 ring-gold/30 relative overflow-hidden">
          <Sparkles className="absolute -right-2 -top-2 h-20 w-20 text-gold/20" />
          <p className="text-xs uppercase tracking-[0.18em] text-gold/90 font-medium">This year</p>
          <p className="font-display text-5xl mt-1">{finishedThisYear}</p>
          <p className="text-sm text-primary-foreground/80 mt-1">
            books finished · {totalAllReads} lifetime reads
          </p>
          {progress !== null && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-primary-foreground/80 mb-1.5">
                <span>{primaryGoal!.target} book goal</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-primary-foreground/15 overflow-hidden">
                <div
                  className="h-full bg-gold transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-5 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Currently reading</h2>
          <button
            onClick={() => setSearching(true)}
            className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:text-primary/80"
          >
            <Plus className="h-3.5 w-3.5" /> Add book
          </button>
        </div>

        {reading.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
            <BookOpen className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nothing on your bookmark yet.</p>
            <button
              onClick={() => setSearching(true)}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Find a book →
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {reading.map((b) => {
              const pct = b.totalPages
                ? Math.min(100, Math.round(((b.currentPage ?? 0) / b.totalPages) * 100))
                : 0;
              return (
                <li key={b.id}>
                  <Link
                    to="/book/$id"
                    params={{ id: b.id }}
                    className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border hover:shadow-sm transition-shadow"
                  >
                    <BookCover book={b} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                      {b.totalPages ? (
                        <>
                          <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            p. {b.currentPage ?? 0} / {b.totalPages} · {pct}%
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-2">Tap to set progress</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
            });
            setSearching(false);
          }}
        />
      )}
    </>
  );
}
