import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { rowanInsights, type RowanCommand } from "@/lib/rowan-fns";

export function Insights({
  sessionId,
  run,
  busy,
}: {
  sessionId: string;
  run: (command: RowanCommand) => void;
  busy: boolean;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const query = useQuery({
    queryKey: ["rowan", sessionId, "insights", year],
    queryFn: () => rowanInsights({ data: { sessionId, year } }),
  });
  return (
    <section id="insights" className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Your reading insights</h2>
        <div className="flex items-center gap-3">
          <button
            aria-label="Previous year"
            disabled={year <= 1900}
            onClick={() => setYear(year - 1)}
          >
            ←
          </button>
          <span>{year}</span>
          <button aria-label="Next year" disabled={year >= 9998} onClick={() => setYear(year + 1)}>
            →
          </button>
        </div>
      </div>
      {query.isPending && <p role="status">Loading your insights…</p>}
      {query.isError && (
        <p role="alert">
          Insights could not load. <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {query.data && (
        <>
          <form
            key={`${year}:${query.data.goal}`}
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run({
                type: "annualGoal",
                key: crypto.randomUUID(),
                year,
                target: Number(data.get("target")),
              });
            }}
          >
            <label className="grid gap-1 text-sm">
              Books to finish in {year}
              <input
                className="rounded-lg border border-border bg-background p-2"
                name="target"
                type="number"
                min={1}
                max={10000}
                required
                defaultValue={query.data.goal ?? ""}
              />
            </label>
            <button className="rounded-lg border border-border px-3 py-2 text-sm" disabled={busy}>
              Save goal
            </button>
            {query.data.goal !== null && (
              <p>
                {query.data.finishedReads} of {query.data.goal} reads ·{" "}
                {Math.round((query.data.finishedReads / query.data.goal) * 100)}%
              </p>
            )}
          </form>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Reads finished this year", query.data.finishedReads],
              ["Distinct books finished", query.data.uniqueWorks],
              ["Books in your library", query.data.libraryCount],
              ["Average personal rating", query.data.averageRating?.toFixed(1) ?? "Unrated"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-display text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
          <div
            className="grid grid-cols-6 gap-2 md:grid-cols-12"
            aria-label="Completed reads by month"
          >
            {query.data.months.map((count, month) => (
              <div className="rounded-lg bg-muted p-2 text-center" key={month}>
                <p className="text-xs">
                  {new Date(Date.UTC(2020, month, 1)).toLocaleString(undefined, {
                    month: "short",
                    timeZone: "UTC",
                  })}
                </p>
                <p className="font-semibold">{count}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Completion counts include rereads and use recorded finish dates in UTC. Undated reads
            are excluded. Ratings cover your entire library.
          </p>
        </>
      )}
    </section>
  );
}
