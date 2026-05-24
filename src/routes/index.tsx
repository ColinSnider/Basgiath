import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import {
  BookOpen,
  Plus,
  Target,
  Quote,
  StickyNote,
  Sparkles,
  Stars,
  Trophy,
  Flame,
  Orbit,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/")({ component: Home });

function Dashboard() {
  const { books, margins, goals, addBook } = useStore();
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const [readsTab, setReadsTab] = useState<"current" | "recent">("current");
  const year = new Date().getFullYear();

  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");
  const tbr = books.filter((b) => b.status === "wishlist");
  const finishedThisYear = books.reduce((sum, b) => sum + readsInYear(b, year), 0);
  const totalAllReads = books.reduce((sum, b) => sum + totalReads(b), 0);
  const recentMargins = [...margins]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const recentlyFinished = [...books]
    .filter((b) => b.reads.length > 0)
    .map((b) => ({ book: b, at: b.reads[b.reads.length - 1].finishedAt }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const streakish = useMemo(() => {
    const days = new Set(
      books.flatMap((b) => b.reads.map((r) => new Date(r.finishedAt).toDateString())),
    );
    return days.size;
  }, [books]);

  return (
    <>
      <AppHeader title="Basgiath" subtitle={`Welcome back, ${user?.displayName ?? "Reader"}.`} />
      <main className="px-5 pb-8 md:px-8 md:pb-10 xl:px-10">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.15fr)_340px] 2xl:gap-5">
          <div className="space-y-4 2xl:space-y-5">
            <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary via-primary/85 to-gold/90 text-primary-foreground p-6 shadow-xl">
              <Orbit className="absolute left-4 top-4 h-5 w-5 text-white/25" />
              <Sparkles className="absolute right-5 top-5 h-8 w-8 text-white/60" />
              <Stars className="absolute left-0 bottom-0 h-20 w-20 text-white/10" />
              <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/75">
                {year} Reading
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

            <section className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-3">
              <Link
                to="/library"
                className="relative overflow-hidden border border-border bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <Trophy className="absolute -right-2 -top-2 h-14 w-14 text-gold/15" />
                <p className="text-xs text-muted-foreground">Reading Sessions</p>
                <p className="font-display text-4xl mt-1">{streakish}</p>
              </Link>
              <Link
                to="/goals"
                className="relative overflow-hidden border border-border bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <Flame className="absolute -right-2 -bottom-1 h-12 w-12 text-primary/15" />
                <p className="text-xs text-muted-foreground">Active Goals</p>
                <p className="font-display text-4xl mt-1">{goals.length}</p>
              </Link>
              <button
                onClick={() => setSearching(true)}
                className="relative text-left border border-primary/30 bg-gradient-to-br from-gold/35 to-primary/15 rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <WandSparkles className="absolute right-3 top-3 h-4 w-4 text-primary/70" />
                <p className="text-xs text-muted-foreground">Discover</p>
                <p className="font-display text-2xl mt-1 inline-flex items-center gap-1">
                  Add a Book <Plus className="h-4 w-4" />
                </p>
              </button>
            </section>

            <section className="grid xl:grid-cols-[minmax(0,1.9fr)_minmax(220px,1fr)] gap-4 items-start">
              <div className="rounded-xl border border-border bg-card p-4 xl:p-5">
                <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                  <h2 className="font-display text-2xl">Reading</h2>
                  <div className="inline-flex bg-muted/70 rounded-lg p-1 border border-border">
                    <button
                      onClick={() => setReadsTab("current")}
                      className={`px-3 py-1.5 text-xs rounded-md ${readsTab === "current" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                    >
                      Current Reads
                    </button>
                    <button
                      onClick={() => setReadsTab("recent")}
                      className={`px-3 py-1.5 text-xs rounded-md ${readsTab === "recent" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                    >
                      Recent Reads
                    </button>
                  </div>
                  <button
                    onClick={() => setSearching(true)}
                    className="text-xs font-medium text-primary inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                {readsTab === "current" ? (
                  reading.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing on your bookmark yet.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                      {reading.slice(0, 9).map((b) => (
                        <Link
                          key={b.id}
                          to="/book/$id"
                          params={{ id: b.id }}
                          className="border border-border rounded-lg p-3.5 flex items-center gap-3.5 hover:bg-muted/40 min-w-0"
                        >
                          <BookCover book={b} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold line-clamp-2 leading-tight">
                              {b.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {b.author}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                p. {b.currentPage || 0}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                {totalReads(b)} reads
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                ) : recentlyFinished.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent finished reads yet.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {recentlyFinished.map(({ book, at }) => (
                      <Link
                        key={`${book.id}-${at}`}
                        to="/book/$id"
                        params={{ id: book.id }}
                        className="border border-border rounded-lg p-3.5 hover:bg-muted/40 min-w-0"
                      >
                        <div className="flex items-center gap-3">
                          <BookCover book={book} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold line-clamp-2 leading-tight">
                              {book.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {book.author}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                p. {book.currentPage || 0}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                {totalReads(book)} reads
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/80 mt-1">
                              Finished {new Date(at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 xl:p-5 xl:hidden">
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

            <section className="rounded-xl border border-border bg-card p-4 xl:p-5">
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
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 xl:p-5">
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
            </div>
          </aside>
        </div>
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
    <div className="min-h-screen bg-background px-5 py-10 md:px-8 xl:px-14">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 xl:grid-cols-[1.15fr_0.9fr]">
        <section className="hidden xl:flex min-h-[42rem] rounded-[2rem] border border-gold/40 bg-gradient-to-br from-primary via-primary/90 to-gold/75 text-primary-foreground p-12 shadow-[0_24px_80px_-30px_rgba(86,25,34,0.7)] flex-col justify-between relative overflow-hidden">
          <Sparkles className="absolute -right-8 top-8 h-28 w-28 text-gold/30" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary-foreground/75">Welcome</p>
            <h1 className="font-display text-6xl mt-4 leading-tight">Basgiath</h1>
            <p className="mt-5 text-lg text-primary-foreground/85 max-w-lg">
              A refined reading hub for tracking books, audiobooks, goals, and margin notes.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-gold/45 bg-black/15 p-3">Personal library timeline</div>
            <div className="rounded-xl border border-gold/45 bg-black/15 p-3">Golden goal streaks</div>
            <div className="rounded-xl border border-gold/45 bg-black/15 p-3">Margin notes that stay searchable</div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-md xl:max-w-xl xl:justify-self-center rounded-[1.5rem] border border-gold/40 bg-card/95 p-8 text-center shadow-[0_20px_50px_-32px_rgba(81,43,20,0.65)] backdrop-blur-sm">
          <BookOpen className="mx-auto h-10 w-10 text-primary" />
          <h2 className="font-display text-5xl mt-4">Basgiath</h2>
          <p className="text-muted-foreground mt-3 text-base">
            Track books, audiobooks, margins, and goals with a focused desktop experience.
          </p>
          <Link
            to="/login"
            className="inline-block mt-7 rounded-md bg-primary px-6 py-3 text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
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
