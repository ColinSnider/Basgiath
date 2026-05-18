import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Sparkles, Plus, Target, ChevronLeft, ChevronRight, BookMarked, NotebookPen, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/")({
  component: Home,
});

function startOf(timeframe: "week" | "month" | "year") {
  const now = new Date();
  if (timeframe === "year") return new Date(now.getFullYear(), 0, 1);
  if (timeframe === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>

        <h1 className="font-display text-5xl text-primary tracking-tight">Basgiath</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-xs leading-relaxed">
          A quiet place to track the books that shape you.
        </p>

        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <Link
            to="/login"
            className="w-full rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start reading
          </Link>
          <Link
            to="/login"
            className="w-full rounded-xl border border-border py-3.5 text-center text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 pb-16 space-y-4 max-w-md mx-auto w-full">
        <Feature
          icon={<BookMarked className="h-5 w-5 text-primary" />}
          title="Track your library"
          desc="Log every book you've read, are reading, or want to read — with progress, format, and finish dates."
        />
        <Feature
          icon={<NotebookPen className="h-5 w-5 text-primary" />}
          title="Capture margins"
          desc="Save quotes and notes while you read. Every thought, in one place."
        />
        <Feature
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
          title="Set reading goals"
          desc="Weekly, monthly, or yearly — see your progress at a glance on the dashboard."
        />
        <Feature
          icon={<Target className="h-5 w-5 text-primary" />}
          title="Books & audiobooks"
          desc="Track pages or listening time. Backdated reads supported."
        />
      </div>

      <p className="text-center text-xs text-muted-foreground pb-8">
        Your reading data is private and tied to your account.
      </p>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start bg-card border border-border rounded-xl p-4">
      <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { books, goals, addBook } = useStore();
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const [goalIdx, setGoalIdx] = useState(0);
  const year = new Date().getFullYear();

  const reading = books.filter((b) => b.status === "reading");
  const finishedThisYear = books.reduce((sum, b) => sum + readsInYear(b, year), 0);
  const totalAllReads = books.reduce((sum, b) => sum + totalReads(b), 0);

  useEffect(() => {
    if (goals.length <= 1) return;
    const id = setInterval(() => setGoalIdx((i) => (i + 1) % goals.length), 4000);
    return () => clearInterval(id);
  }, [goals.length]);

  const activeGoal = goals[goalIdx] ?? null;

  function progressFor(g: typeof activeGoal) {
    if (!g) return 0;
    const since = startOf(g.timeframe);
    if (g.metric === "books") {
      return books.reduce((sum, b) => sum + b.reads.filter((r) => new Date(r.finishedAt) >= since).length, 0);
    }
    if (g.metric === "pages") {
      return books.reduce((sum, b) => {
        const finished = b.reads.filter((r) => new Date(r.finishedAt) >= since).length;
        return sum + finished * (b.totalPages ?? 0);
      }, 0);
    }
    return 0;
  }

  const prog = activeGoal ? progressFor(activeGoal) : null;
  const progress = activeGoal && prog !== null ? Math.min(100, Math.round((prog / activeGoal.target) * 100)) : null;
  const progressLabel = activeGoal ? `${prog} / ${activeGoal.target} ${activeGoal.metric}` : null;

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <>
      <AppHeader title="Basgiath" subtitle={`Welcome back, ${firstName}.`} />

      <section className="px-5">
        <div className="rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-5 shadow-lg ring-1 ring-gold/30 relative overflow-hidden">
          <Sparkles className="absolute -right-2 -top-2 h-20 w-20 text-gold/20" />

          <p className="text-xs uppercase tracking-[0.18em] text-gold/90 font-medium">This year</p>
          <p className="font-display text-5xl mt-1">{finishedThisYear}</p>
          <p className="text-sm text-primary-foreground/80 mt-1">
            books finished · {totalAllReads} lifetime reads
          </p>

          {goals.length > 0 && activeGoal && progress !== null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-primary-foreground/80 mb-1.5">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  <span className="capitalize">{activeGoal.timeframe}ly goal · {progressLabel}</span>
                </span>
                <div className="flex items-center gap-1">
                  {goals.length > 1 && (
                    <>
                      <button onClick={() => setGoalIdx((i) => (i - 1 + goals.length) % goals.length)} className="hover:text-white p-0.5">
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span>{goalIdx + 1}/{goals.length}</span>
                      <button onClick={() => setGoalIdx((i) => (i + 1) % goals.length)} className="hover:text-white p-0.5">
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  <span className="ml-1">{progress}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-primary-foreground/15 overflow-hidden">
                <div className="h-full bg-gold transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              {goals.length > 1 && (
                <div className="flex justify-center gap-1 mt-2">
                  {goals.map((_, i) => (
                    <button key={i} onClick={() => setGoalIdx(i)} className={`h-1 rounded-full transition-all ${i === goalIdx ? "w-4 bg-gold" : "w-1 bg-primary-foreground/30"}`} />
                  ))}
                </div>
              )}
            </div>
          )}
          {goals.length === 0 && (
            <div className="mt-4">
              <Link to="/goals" className="text-[11px] text-gold/80 hover:text-gold underline underline-offset-2">
                Set a reading goal →
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="px-5 mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Currently reading</h2>
          <button onClick={() => setSearching(true)} className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:text-primary/80">
            <Plus className="h-3.5 w-3.5" /> Add book
          </button>
        </div>

        {reading.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
            <BookOpen className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nothing on your bookmark yet.</p>
            <button onClick={() => setSearching(true)} className="mt-3 text-sm font-medium text-primary hover:underline">
              Find a book →
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {reading.map((b) => {
              const isAudio = b.format === "audiobook";
              const pct = isAudio
                ? b.durationMinutes ? Math.min(100, Math.round(((b.currentMinute ?? 0) / b.durationMinutes) * 100)) : 0
                : b.totalPages ? Math.min(100, Math.round(((b.currentPage ?? 0) / b.totalPages) * 100)) : 0;
              return (
                <li key={b.id}>
                  <Link to="/book/$id" params={{ id: b.id }} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border hover:shadow-sm transition-shadow">
                    <BookCover book={b} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                      {isAudio ? (
                        b.durationMinutes ? (
                          <>
                            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {Math.floor((b.currentMinute ?? 0) / 60)}h {(b.currentMinute ?? 0) % 60}m / {Math.floor(b.durationMinutes / 60)}h {b.durationMinutes % 60}m · {pct}%
                            </p>
                          </>
                        ) : <p className="text-[11px] text-muted-foreground mt-2">🎧 Audiobook · tap to set progress</p>
                      ) : (
                        b.totalPages ? (
                          <>
                            <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">p. {b.currentPage ?? 0} / {b.totalPages} · {pct}%</p>
                          </>
                        ) : <p className="text-[11px] text-muted-foreground mt-2">Tap to set progress</p>
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
            addBook({ title: r.title, author: r.author, coverUrl: r.coverUrl, totalPages: r.totalPages, currentPage: 0, format: r.format ?? "book", durationMinutes: r.durationMinutes, status: r.status ?? "reading", reads: r.finishedAt ? [{ finishedAt: r.finishedAt }] : [], addedAt: r.addedAt, extraReads: r.extraReads });
            setSearching(false);
          }}
        />
      )}
    </>
  );
}

function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <LandingPage />;
  return <Dashboard />;
}
