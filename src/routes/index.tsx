import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Plus, Target, Quote, StickyNote, Sparkles, Stars, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/")({ component: Home });

function Dashboard() {
  const { books, margins, goals, addBook } = useStore();
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const year = new Date().getFullYear();

  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");
  const tbr = books.filter((b) => b.status === "wishlist");
  const finishedThisYear = books.reduce((sum, b) => sum + readsInYear(b, year), 0);
  const totalAllReads = books.reduce((sum, b) => sum + totalReads(b), 0);
  const recentMargins = [...margins]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const streakish = useMemo(() => {
    const days = new Set(
      books.flatMap((b) => b.reads.map((r) => new Date(r.finishedAt).toDateString())),
    );
    return days.size;
  }, [books]);

  return (
    <>
      <AppHeader title="Basgiath" subtitle={`Welcome back, ${user?.displayName ?? "Reader"}.`} />
      <main className="px-5 pb-8 max-w-7xl mx-auto space-y-4">
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary via-primary/85 to-gold/90 text-primary-foreground p-6 shadow-xl">
          <Sparkles className="absolute right-5 top-5 h-8 w-8 text-white/60" />
          <Stars className="absolute -left-3 -bottom-3 h-20 w-20 text-white/10" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/75">
            {year} Reading Aura
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <p className="font-display text-6xl leading-none">{finishedThisYear}</p>
            <p className="text-sm text-primary-foreground/80 pb-1">
              books finished · {totalAllReads} lifetime reads
            </p>
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-black/15 border border-white/15 p-2">
              Current: <b>{reading.length}</b>
            </div>
            <div className="rounded-lg bg-black/15 border border-white/15 p-2">
              Past Reads: <b>{finished.length}</b>
            </div>
            <div className="rounded-lg bg-black/15 border border-white/15 p-2">
              TBR: <b>{tbr.length}</b>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-3">
          <Link
            to="/library"
            className="relative overflow-hidden border border-border bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
          >
            <Trophy className="absolute -right-2 -top-2 h-14 w-14 text-gold/15" />
            <p className="text-xs text-muted-foreground">Reading Sessions</p>
            <p className="font-display text-4xl mt-1">{streakish}</p>
          </Link>
          <Link
            to="/goals"
            className="border border-border bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
          >
            <p className="text-xs text-muted-foreground">Active Goals</p>
            <p className="font-display text-4xl mt-1">{goals.length}</p>
          </Link>
          <button
            onClick={() => setSearching(true)}
            className="text-left border border-primary/30 bg-gradient-to-br from-gold/35 to-primary/15 rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
          >
            <p className="text-xs text-muted-foreground">Discover</p>
            <p className="font-display text-2xl mt-1 inline-flex items-center gap-1">
              Add a Book <Plus className="h-4 w-4" />
            </p>
          </button>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl">Reading now</h2>
              <button
                onClick={() => setSearching(true)}
                className="text-xs font-medium text-primary inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {reading.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on your bookmark yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {reading.slice(0, 6).map((b) => (
                  <Link
                    key={b.id}
                    to="/book/$id"
                    params={{ id: b.id }}
                    className="border border-border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/40"
                  >
                    <BookCover book={b} size="sm" />
                    <div>
                      <p className="text-sm font-semibold line-clamp-1">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.author}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-xl mb-3 inline-flex gap-1 items-center">
              <Target className="h-4 w-4 text-primary" />
              Goals + Momentum
            </h2>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals set.</p>
            ) : (
              <ul className="space-y-2">
                {goals.map((g) => (
                  <li key={g.id}>
                    <Link
                      to="/goals"
                      className="block border border-border rounded-lg p-2.5 hover:bg-muted/40"
                    >
                      <p className="text-sm capitalize">
                        {g.timeframe}ly {g.metric}
                      </p>
                      <p className="text-xs text-muted-foreground">Target: {g.target}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-xl mb-3">Recent margins</h2>
          {recentMargins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No margins yet.</p>
          ) : (
            <ul className="grid lg:grid-cols-2 gap-2">
              {recentMargins.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/margins"
                    className="block border border-border rounded-lg p-2.5 hover:bg-muted/40"
                  >
                    <p className="text-sm line-clamp-2">{m.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                      {m.type === "quote" ? (
                        <Quote className="h-3 w-3" />
                      ) : (
                        <StickyNote className="h-3 w-3" />
                      )}
                      {m.type}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

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
              format: r.format ?? "book",
              durationMinutes: r.durationMinutes,
              status: r.status ?? "reading",
              reads: r.finishedAt ? [{ finishedAt: r.finishedAt }] : [],
              addedAt: r.addedAt,
              extraReads: r.extraReads,
            });
            setSearching(false);
          }}
        />
      )}
    </>
  );
}

function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <BookOpen className="h-8 w-8 text-primary mx-auto" />
        <h1 className="font-display text-5xl mt-3">Basgiath</h1>
        <p className="text-muted-foreground mt-3">Track books, audiobooks, margins, and goals.</p>
        <Link
          to="/login"
          className="inline-block mt-6 bg-primary text-primary-foreground px-5 py-3 rounded-md"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Landing />;
  return <Dashboard />;
}
