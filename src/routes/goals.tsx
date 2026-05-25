import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useStore, type Book, type Goal } from "@/lib/basgiath-store";
import { useMemo, useState } from "react";
import { Trash2, Plus, Target as TargetIcon, Trophy } from "lucide-react";

export const Route = createFileRoute("/goals")({ component: Goals });

const METRIC_LABEL: Record<Goal["metric"], string> = { books: "books", pages: "pages", minutes: "hours" };
const startOf = (t: Goal["timeframe"]) => {
  const n = new Date();
  if (t === "year") return new Date(n.getFullYear(), 0, 1);
  if (t === "month") return new Date(n.getFullYear(), n.getMonth(), 1);
  const d = new Date(n);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

function readDurationDays(book: Book, index: number) {
  const finishedAt = new Date(book.reads[index]?.finishedAt ?? "");
  if (Number.isNaN(finishedAt.getTime())) return null;
  const start = new Date(book.addedAt);
  const diff = Math.max(1, (finishedAt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function Goals() {
  const { goals, books, addGoal, removeGoal } = useStore();
  const [view, setView] = useState<"goals" | "achievements">("goals");
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState<Goal["metric"]>("books");
  const [timeframe, setTimeframe] = useState<Goal["timeframe"]>("year");
  const [target, setTarget] = useState("12");
  const [openGoal, setOpenGoal] = useState<string | null>(null);

  const progressFor = (g: Goal) => {
    const since = startOf(g.timeframe);
    if (g.metric === "books") return books.reduce((s, b) => s + b.reads.filter((r) => new Date(r.finishedAt) >= since).length, 0);
    if (g.metric === "pages") return books.filter((b) => b.format !== "audiobook").reduce((s, b) => s + b.reads.filter((r) => new Date(r.finishedAt) >= since).length * (b.totalPages ?? 0), 0);
    const mins = books.filter((b) => b.format === "audiobook").reduce((s, b) => s + b.reads.filter((r) => new Date(r.finishedAt) >= since).length * (b.durationMinutes ?? 0), 0);
    return Math.round((mins / 60) * 10) / 10;
  };
  const contributing = (g: Goal) => {
    const since = startOf(g.timeframe);
    return books.filter((b) => {
      if (g.metric === "minutes" && b.format !== "audiobook") return false;
      if (g.metric === "pages" && b.format === "audiobook") return false;
      return b.reads.some((r) => new Date(r.finishedAt) >= since);
    });
  };

  const achievements = useMemo(() => {
    const allReads = books.flatMap((book) => book.reads.map((read, i) => ({ book, read, i })));
    const finishedBooks = books.filter((book) => book.reads.length > 0);
    const now = Date.now();

    const fastest = allReads
      .map(({ book, i }) => ({ book, days: readDurationDays(book, i) }))
      .filter((row): row is { book: Book; days: number } => row.days !== null)
      .sort((a, b) => a.days - b.days)[0];

    const pagesByDay = new Map<string, number>();
    const booksByWeek = new Map<string, number>();
    const booksByDay = new Map<string, number>();
    const pagesByWeek = new Map<string, number>();
    const formats = { books: 0 };
    const readStreakDays = new Set<string>();
    let totalPages = 0;
    let totalMinutes = 0;

    for (const { book, read } of allReads) {
      const dt = new Date(read.finishedAt);
      const dayKey = dt.toISOString().slice(0, 10);
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      const pages = book.format === "audiobook" ? 0 : book.totalPages ?? 0;
      pagesByDay.set(dayKey, (pagesByDay.get(dayKey) ?? 0) + pages);
      booksByWeek.set(weekKey, (booksByWeek.get(weekKey) ?? 0) + 1);
      booksByDay.set(dayKey, (booksByDay.get(dayKey) ?? 0) + 1);
      pagesByWeek.set(weekKey, (pagesByWeek.get(weekKey) ?? 0) + pages);
      readStreakDays.add(dayKey);
      totalPages += pages;
      if (book.format === "audiobook") totalMinutes += book.durationMinutes ?? 0;
      if (book.format !== "audiobook") formats.books += 1;
    }

    const topPagesDay = [...pagesByDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const topBooksWeek = [...booksByWeek.entries()].sort((a, b) => b[1] - a[1])[0];
    const topBooksDay = [...booksByDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const topPagesWeek = [...pagesByWeek.entries()].sort((a, b) => b[1] - a[1])[0];
    const longestBook = finishedBooks.filter((b) => b.totalPages).sort((a, b) => (b.totalPages ?? 0) - (a.totalPages ?? 0))[0];
    const shortestBook = finishedBooks.filter((b) => b.totalPages).sort((a, b) => (a.totalPages ?? 0) - (b.totalPages ?? 0))[0];
    const rereadChampion = books
      .filter((b) => b.reads.length > 1)
      .sort((a, b) => b.reads.length - a.reads.length)[0];
    const oldestFinish = allReads.sort((a, b) => new Date(a.read.finishedAt).getTime() - new Date(b.read.finishedAt).getTime())[0];
    const recentFinish = allReads.sort((a, b) => new Date(b.read.finishedAt).getTime() - new Date(a.read.finishedAt).getTime())[0];
    const uniqueAuthors = new Set(finishedBooks.map((b) => b.author.trim().toLowerCase()).filter(Boolean)).size;
    const avgPagesPerBook = formats.books ? Math.round(totalPages / formats.books) : 0;
    const longestStreak = (() => {
      const dates = [...readStreakDays].sort();
      if (!dates.length) return 0;
      let best = 1;
      let run = 1;
      for (let i = 1; i < dates.length; i += 1) {
        const prev = new Date(dates[i - 1]).getTime();
        const curr = new Date(dates[i]).getTime();
        if (curr - prev === 24 * 60 * 60 * 1000) run += 1;
        else run = 1;
        best = Math.max(best, run);
      }
      return best;
    })();
    const finishedLast30 = allReads.filter(({ read }) => now - new Date(read.finishedAt).getTime() <= 30 * 24 * 60 * 60 * 1000).length;

    return [
      {
        label: "Fastest cover to cover",
        value: fastest ? `${fastest.book.title} · ${Math.round(fastest.days)} day${Math.round(fastest.days) === 1 ? "" : "s"}` : "No completed books yet",
      },
      {
        label: "Most pages in one day",
        value: topPagesDay ? `${topPagesDay[1]} pages · ${topPagesDay[0]}` : "No page-based reads yet",
      },
      {
        label: "Most books in one week",
        value: topBooksWeek ? `${topBooksWeek[1]} books · week of ${topBooksWeek[0]}` : "No completed books yet",
      },
      { label: "Most books in one day", value: topBooksDay ? `${topBooksDay[1]} books · ${topBooksDay[0]}` : "No completed books yet" },
      { label: "Most pages in one week", value: topPagesWeek ? `${topPagesWeek[1]} pages · week of ${topPagesWeek[0]}` : "No page-based reads yet" },
      { label: "Longest book finished", value: longestBook ? `${longestBook.title} · ${longestBook.totalPages} pages` : "No page-based reads yet" },
      { label: "Shortest book finished", value: shortestBook ? `${shortestBook.title} · ${shortestBook.totalPages} pages` : "No page-based reads yet" },
      { label: "Most re-read book", value: rereadChampion ? `${rereadChampion.title} · ${rereadChampion.reads.length} finishes` : "No re-reads logged yet" },
      { label: "Longest reading streak", value: longestStreak ? `${longestStreak} day${longestStreak === 1 ? "" : "s"}` : "No reading streak yet" },
      { label: "Books finished in 30 days", value: `${finishedLast30} in the last 30 days` },
      { label: "Average pages per book", value: avgPagesPerBook ? `${avgPagesPerBook} pages` : "No page-based reads yet" },
      { label: "First completion logged", value: oldestFinish ? `${oldestFinish.book.title} · ${oldestFinish.read.finishedAt.slice(0, 10)}` : "No completions yet" },
      { label: "Latest completion logged", value: recentFinish ? `${recentFinish.book.title} · ${recentFinish.read.finishedAt.slice(0, 10)}` : "No completions yet" },
      { label: "Unique authors finished", value: `${uniqueAuthors} author${uniqueAuthors === 1 ? "" : "s"}` },
      { label: "Listening hours completed", value: `${Math.round((totalMinutes / 60) * 10) / 10} hours` },
    ];
  }, [books]);

  return (
    <>
      <AppHeader title="Goals" subtitle="Set your own pace." />
      <section className="px-5 mt-1">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["goals", "achievements"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                view === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "goals" ? "Goals" : "Achievements"}
            </button>
          ))}
        </div>
      </section>

      {view === "achievements" ? (
        <section className="px-5 mt-5 space-y-3">
          {achievements.map((item) => (
            <div key={item.label} className="bg-card border border-border rounded-md p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold font-semibold">
                <Trophy className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">{item.value}</p>
            </div>
          ))}
        </section>
      ) : (
        <>
          <section className="px-5 space-y-3 mt-5">
            {goals.map((g) => {
              const prog = progressFor(g);
              const pct = Math.min(100, Math.round((prog / g.target) * 100));
              const list = contributing(g);
              const open = openGoal === g.id;
              return (
                <div key={g.id} className="bg-card border border-border rounded-md p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold font-semibold">
                    <TargetIcon className="h-3.5 w-3.5" />
                    <span>{g.timeframe}ly</span>
                  </div>
                  <button onClick={() => setOpenGoal(open ? null : g.id)} className="w-full text-left">
                    <p className="font-display text-2xl mt-1.5">
                      {prog} <span className="text-muted-foreground text-base">/ {g.target}</span>{" "}
                      <span className="text-sm text-muted-foreground">{METRIC_LABEL[g.metric]}</span>
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-gold" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{pct}% there · tap for contributing books</p>
                  </button>
                  {open && (
                    <ul className="mt-3 space-y-1">
                      {list.map((b) => (
                        <li key={b.id} className="text-xs text-muted-foreground">
                          • {b.title}
                        </li>
                      ))}
                      {list.length === 0 && <li className="text-xs text-muted-foreground">No contributing books yet.</li>}
                    </ul>
                  )}
                  <button onClick={() => removeGoal(g.id)} className="mt-3 text-muted-foreground/60 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </section>
          <section className="px-5 mt-5">
            {!adding ? (
              <button onClick={() => setAdding(true)} className="w-full border border-dashed border-border text-sm py-3 rounded-md text-muted-foreground">
                <Plus className="h-4 w-4 inline" /> New goal
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(target);
                  if (!n || n < 1) return;
                  addGoal({ metric, timeframe, target: n });
                  setAdding(false);
                }}
                className="bg-card border border-border rounded-md p-4 space-y-3"
              >
                <div className="flex gap-2">
                  {(["books", "pages", "minutes"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetric(m)}
                      className={`flex-1 py-2 text-xs rounded-md ${metric === m ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {m === "minutes" ? "hours" : m}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(["week", "month", "year"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTimeframe(t)}
                      className={`flex-1 py-2 text-xs rounded-md ${timeframe === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {t}ly
                    </button>
                  ))}
                </div>
                <input value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} className="w-full bg-muted rounded-md px-3 py-2 text-sm" />
                <button type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md text-sm">
                  Create
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </>
  );
}
