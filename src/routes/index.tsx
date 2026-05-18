import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import {
  BookOpen, Sparkles, Plus, Target, ChevronLeft, ChevronRight,
  BookMarked, NotebookPen, BarChart3, Quote, StickyNote, CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { BookSearch } from "@/components/BookSearch";
import type { Book } from "@/lib/basgiath-store";

export const Route = createFileRoute("/")({
  component: Home,
});

/* ── helpers ── */
function startOf(timeframe: "week" | "month" | "year") {
  const now = new Date();
  if (timeframe === "year") return new Date(now.getFullYear(), 0, 1);
  if (timeframe === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ── SVG progress ring ── */
function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
      {pct > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--primary)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      )}
    </svg>
  );
}

/* ── stat pill ── */
function StatPill({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex-1 flex flex-col items-center gap-0.5 bg-card border border-border rounded-xl py-3 px-2 hover:shadow-sm transition-shadow text-center">
      <span className="font-display text-2xl text-foreground leading-none">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </Link>
  );
}

/* ── reading card (horizontal scroll) ── */
function ReadingCard({ book }: { book: Book }) {
  const isAudio = book.format === "audiobook";
  const pct = isAudio
    ? book.durationMinutes ? Math.min(100, Math.round(((book.currentMinute ?? 0) / book.durationMinutes) * 100)) : 0
    : book.totalPages ? Math.min(100, Math.round(((book.currentPage ?? 0) / book.totalPages) * 100)) : 0;

  const ringSize = 80;

  return (
    <Link
      to="/book/$id"
      params={{ id: book.id }}
      className="shrink-0 w-40 flex flex-col items-center gap-2 bg-card border border-border rounded-xl p-3 hover:shadow-md transition-shadow"
    >
      {/* Cover with progress ring */}
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <ProgressRing pct={pct} size={ringSize} />
        <div className="absolute inset-0 flex items-center justify-center">
          <BookCover book={book} size="sm" />
        </div>
        {pct > 0 && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-semibold rounded-full px-1.5 py-0.5 leading-none shadow">
            {pct}%
          </div>
        )}
      </div>

      <div className="w-full text-center">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{book.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{book.author}</p>
      </div>
    </Link>
  );
}

/* ── landing page (unauthenticated) ── */
function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-5xl text-primary tracking-tight">Basgiath</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-xs leading-relaxed">
          A quiet place to track the books that shape you.
        </p>
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
          <Link to="/login" className="w-full rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Start reading
          </Link>
          <Link to="/login" className="w-full rounded-xl border border-border py-3.5 text-center text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
      <div className="px-6 pb-16 space-y-4 max-w-md mx-auto w-full">
        {[
          { icon: <BookMarked className="h-5 w-5 text-primary" />, title: "Track your library", desc: "Log every book — with progress, format, and finish dates." },
          { icon: <NotebookPen className="h-5 w-5 text-primary" />, title: "Capture margins", desc: "Save quotes and notes while you read. Every thought, in one place." },
          { icon: <BarChart3 className="h-5 w-5 text-primary" />, title: "Set reading goals", desc: "Weekly, monthly, or yearly — see your progress at a glance." },
        ].map((f) => (
          <div key={f.title} className="flex gap-4 items-start bg-card border border-border rounded-xl p-4">
            <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">{f.icon}</div>
            <div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground pb-8">Your reading data is private and tied to your account.</p>
    </div>
  );
}

/* ── main dashboard ── */
function Dashboard() {
  const { books, margins, goals, addBook } = useStore();
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const [goalIdx, setGoalIdx] = useState(0);
  const year = new Date().getFullYear();

  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");
  const wishlist = books.filter((b) => b.status === "wishlist");
  const finishedThisYear = books.reduce((sum, b) => sum + readsInYear(b, year), 0);
  const totalAllReads = books.reduce((sum, b) => sum + totalReads(b), 0);

  // Recent margins
  const recentMargins = [...margins]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Recently finished books
  const recentlyFinished = [...books]
    .filter((b) => b.reads.length > 0)
    .map((b) => ({ book: b, at: new Date(b.reads[b.reads.length - 1].finishedAt) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 4);

  // Goal cycling
  useEffect(() => {
    if (goals.length <= 1) return;
    const id = setInterval(() => setGoalIdx((i) => (i + 1) % goals.length), 4000);
    return () => clearInterval(id);
  }, [goals.length]);

  const activeGoal = goals[goalIdx] ?? null;

  function progressFor(g: typeof activeGoal) {
    if (!g) return 0;
    const since = startOf(g.timeframe);
    if (g.metric === "books") return books.reduce((s, b) => s + b.reads.filter((r) => new Date(r.finishedAt) >= since).length, 0);
    if (g.metric === "pages") return books.reduce((s, b) => s + b.reads.filter((r) => new Date(r.finishedAt) >= since).length * (b.totalPages ?? 0), 0);
    return 0;
  }

  const prog = activeGoal ? progressFor(activeGoal) : null;
  const goalPct = activeGoal && prog !== null ? Math.min(100, Math.round((prog / activeGoal.target) * 100)) : null;
  const goalLabel = activeGoal ? `${prog} / ${activeGoal.target} ${activeGoal.metric}` : null;
  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <>
      <AppHeader title="Basgiath" subtitle={`${greeting()}, ${firstName}.`} />

      {/* ── Hero stats card ── */}
      <section className="px-5">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-5 shadow-lg ring-1 ring-black/10 relative overflow-hidden">
          <Sparkles className="absolute -right-3 -top-3 h-24 w-24 text-white/10 pointer-events-none" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary-foreground/70 font-medium">{year} in books</p>
          <div className="flex items-end gap-3 mt-1">
            <span className="font-display text-6xl leading-none">{finishedThisYear}</span>
            <span className="text-sm text-primary-foreground/70 mb-1.5">finished · {totalAllReads} lifetime</span>
          </div>

          {activeGoal && goalPct !== null && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-primary-foreground/75">
                <span className="flex items-center gap-1.5">
                  <Target className="h-3 w-3" />
                  <span className="capitalize">{activeGoal.timeframe}ly · {goalLabel}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {goals.length > 1 && (
                    <>
                      <button onClick={() => setGoalIdx((i) => (i - 1 + goals.length) % goals.length)} className="hover:text-white"><ChevronLeft className="h-3.5 w-3.5" /></button>
                      <span>{goalIdx + 1}/{goals.length}</span>
                      <button onClick={() => setGoalIdx((i) => (i + 1) % goals.length)} className="hover:text-white"><ChevronRight className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                  <span className="font-semibold ml-1">{goalPct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all duration-700" style={{ width: `${goalPct}%` }} />
              </div>
              {goals.length > 1 && (
                <div className="flex justify-center gap-1 pt-1">
                  {goals.map((_, i) => (
                    <button key={i} onClick={() => setGoalIdx(i)} className={`h-1 rounded-full transition-all ${i === goalIdx ? "w-4 bg-gold" : "w-1 bg-white/25"}`} />
                  ))}
                </div>
              )}
            </div>
          )}
          {goals.length === 0 && (
            <Link to="/goals" className="inline-block mt-4 text-[11px] text-gold/90 hover:text-gold underline underline-offset-2">
              Set a reading goal →
            </Link>
          )}
        </div>
      </section>

      {/* ── Quick stat pills ── */}
      <section className="px-5 mt-4 flex gap-2.5">
        <StatPill label="Reading" value={reading.length} to="/library" />
        <StatPill label="Finished" value={finished.length} to="/library" />
        <StatPill label="Wishlist" value={wishlist.length} to="/library" />
      </section>

      {/* ── Currently reading ── */}
      <section className="mt-7">
        <div className="px-5 flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Reading now</h2>
          <button
            onClick={() => setSearching(true)}
            className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {reading.length === 0 ? (
          <div className="mx-5 rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
            <BookOpen className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nothing on your bookmark yet.</p>
            <button onClick={() => setSearching(true)} className="mt-3 text-sm font-medium text-primary hover:underline">
              Find a book →
            </button>
          </div>
        ) : (
          <div className="pl-5 flex gap-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollSnapType: "x mandatory" }}>
            {reading.map((b) => (
              <div key={b.id} style={{ scrollSnapAlign: "start" }}>
                <ReadingCard book={b} />
              </div>
            ))}
            <div className="shrink-0 w-5" />
          </div>
        )}
      </section>

      {/* ── Recent margins ── */}
      {recentMargins.length > 0 && (
        <section className="px-5 mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl">Recent notes</h2>
            <Link to="/margins" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              See all
            </Link>
          </div>
          <div className="space-y-2.5">
            {recentMargins.map((m) => {
              const book = books.find((b) => b.id === m.bookId);
              return (
                <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex gap-3 items-start">
                  <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
                    {m.type === "quote"
                      ? <Quote className="h-3.5 w-3.5 text-primary" />
                      : <StickyNote className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed line-clamp-3 text-foreground">{m.text}</p>
                    {book && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                        — <span className="italic">{book.title}</span>
                        {m.page ? `, p. ${m.page}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recently finished ── */}
      {recentlyFinished.length > 0 && (
        <section className="px-5 mt-7 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl">Recently finished</h2>
            <Link to="/library" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              Library
            </Link>
          </div>
          <div className="space-y-2">
            {recentlyFinished.map(({ book, at }) => (
              <Link
                key={book.id}
                to="/book/$id"
                params={{ id: book.id }}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:shadow-sm transition-shadow"
              >
                <BookCover book={book} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Finished {at.toLocaleDateString(undefined, { month: "short", day: "numeric", year: at.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-primary/50 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

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
