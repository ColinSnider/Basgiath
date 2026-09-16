import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Feather, Sparkles } from "lucide-react";
import { rowanInsights } from "@/lib/rowan-fns";
import { BookCover } from "./BookCover";

const monthName = (month: number, short = false) =>
  new Date(Date.UTC(2020, month, 1)).toLocaleString(undefined, {
    month: short ? "short" : "long",
    timeZone: "UTC",
  });
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";

export function Insights({ sessionId }: { sessionId: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = useQuery({
    queryKey: ["rowan", sessionId, "insights", year, timeZone],
    queryFn: () => rowanInsights({ data: { sessionId, year, timeZone } }),
  });
  const data = query.data;
  const peak = Math.max(0, ...(data?.months ?? []));
  const peakMonths =
    data?.months.flatMap((count, month) =>
      count > 0 && count === peak ? [monthName(month)] : [],
    ) ?? [];
  return (
    <section id="insights" className="reader-card reader-card-body space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2">
            <Sparkles size={21} aria-hidden="true" /> Your year in books
          </h2>
          <p className="text-sm text-muted-foreground">
            The stories you finished and the patterns along the way.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={control}
            aria-label="Previous year"
            disabled={year <= 1900}
            onClick={() => setYear(year - 1)}
          >
            <ArrowLeft size={18} />
          </button>
          <span aria-live="polite" className="font-medium">
            {year}
          </span>
          <button
            className={control}
            aria-label="Next year"
            disabled={year >= currentYear}
            onClick={() => setYear(year + 1)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </header>
      {query.isPending && <p role="status">Looking back through your reading…</p>}
      {query.isError && (
        <p role="alert">
          Insights could not load. <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {data && (
        <>
          <dl className="reader-insight-totals">
            {[
              { label: "Reads finished", value: data.finishedReads, icon: BookOpen },
              { label: "Different books", value: data.uniqueWorks, icon: Sparkles },
              { label: "Authors read", value: data.authorsRead.length, icon: Feather },
              {
                label: "Months with a finish",
                value: data.months.filter(Boolean).length,
                icon: CalendarDays,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <Icon size={18} aria-hidden="true" />
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {!data.finishedReads ? (
            <p className="text-muted-foreground">
              No dated finishes in {year} yet. Your completed books will tell the story here.
            </p>
          ) : (
            <>
              <div>
                <h3 className="font-display text-xl">Your reading rhythm</h3>
                <p className="text-sm text-muted-foreground">
                  {peakMonths.join(", ")} {peakMonths.length === 1 ? "had" : "each had"} the most
                  finishes: {peak}
                  {peakMonths.length > 1 ? " each" : ""}.
                </p>
              </div>
              <ol className="reader-month-chart" aria-label={`Completed reads by month in ${year}`}>
                {data.months.map((count, month) => (
                  <li key={month} aria-label={`${monthName(month)}: ${count} completed reads`}>
                    <span className="reader-month-count">{count}</span>
                    <span className="reader-month-track" aria-hidden="true">
                      <span style={{ height: `${(count / Math.max(1, peak)) * 100}%` }} />
                    </span>
                    <span>{monthName(month, true)}</span>
                  </li>
                ))}
              </ol>
              <div className="grid gap-4 sm:grid-cols-2">
                {data.longestFinished && (
                  <article className="reader-insight-highlight">
                    <BookOpen size={20} aria-hidden="true" />
                    <h3>Longest book finished</h3>
                    <Link to="/books/$bookId" params={{ bookId: data.longestFinished.userBookId }}>
                      {data.longestFinished.title}
                    </Link>
                    <p>{data.longestFinished.total} pages · length recorded for that read</p>
                  </article>
                )}
                {!!data.authorsRead.length && (
                  <article className="reader-insight-highlight">
                    <Feather size={20} aria-hidden="true" />
                    <h3>Authors you spent time with</h3>
                    <ul>
                      {data.authorsRead.slice(0, 3).map((author) => (
                        <li key={author.name}>
                          {author.name}{" "}
                          <span>
                            · {author.books} {author.books === 1 ? "book" : "books"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
              </div>
              <div>
                <h3 className="font-display text-xl mb-3">Recently finished in {year}</h3>
                <ul className="reader-insight-finishes">
                  {data.recentFinishes.map((book, index) => (
                    <li key={`${book.userBookId}:${index}`}>
                      <Link to="/books/$bookId" params={{ bookId: book.userBookId }}>
                        <BookCover
                          title={book.title}
                          authors={book.authors}
                          src={book.coverUrl}
                          className="rowan-cover-small"
                        />
                        <span>
                          <strong>{book.title}</strong>
                          <small>
                            {book.finishedAt &&
                              new Date(book.finishedAt).toLocaleDateString(undefined, {
                                timeZone,
                                month: "short",
                                day: "numeric",
                              })}{" "}
                            · {book.authors.join(", ")}
                          </small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Finishes include rereads; different-book and author counts count each book once. Dates
            follow your device’s time zone.
            {data.lifetime.undated > 0 &&
              ` ${data.lifetime.undated} undated ${data.lifetime.undated === 1 ? "read is" : "reads are"} preserved in your book histories and excluded from this yearly view.`}
          </p>
        </>
      )}
    </section>
  );
}
