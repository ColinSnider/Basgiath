import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  FileText,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rowanGoals, rowanSaveGoal } from "@/lib/rowan-fns";
import { useAccountMutation } from "./useAccountMutation";

const metrics = {
  books: "Books finished",
  pages: "Pages in finished books",
  minutes: "Audiobook hours finished",
};
const units = { books: "books", pages: "pages", minutes: "hours" };
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const displayDate = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";

export function Goals({ sessionId }: { sessionId: string }) {
  const cache = useQueryClient();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [metric, setMetric] = useState<keyof typeof metrics>("books");
  const [timeframe, setTimeframe] = useState("year");
  const [fixedYear, setFixedYear] = useState(String(new Date().getFullYear()));
  const [editing, setEditing] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState("12");
  const remove = useAccountMutation(sessionId);
  const query = useQuery({
    queryKey: ["rowan", sessionId, "goals", timeZone],
    queryFn: () => rowanGoals({ data: { sessionId, timeZone } }),
    refetchInterval: 60_000,
  });
  const save = useMutation({
    mutationFn: (input: {
      key: string;
      id?: string;
      target: number;
      metric: keyof typeof metrics;
      timeframe: string;
    }) => rowanSaveGoal({ data: { sessionId, ...input } }),
    onSuccess: async () => {
      setEditing(undefined);
      setAdding(false);
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
  });
  const busy = save.isPending || save.isError || remove.busy;
  return (
    <section id="goals" className="reader-goals space-y-5">
      <header className="reader-goals-heading">
        <div>
          <h2 className="font-display text-2xl">A little reading intention</h2>
          <p className="text-muted-foreground">
            Choose something to work toward, at your own pace.
          </p>
        </div>
        <button
          className={control}
          disabled={busy}
          onClick={() => {
            setEditing(undefined);
            setAdding(true);
            setTarget("12");
            setMetric("books");
            setTimeframe("year");
          }}
        >
          <Plus size={16} aria-hidden="true" /> New goal
        </button>
      </header>
      {(adding || editing) && (
        <form
          className="reader-goal-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            save.mutate({
              key: crypto.randomUUID(),
              id: editing,
              target: Number(target),
              metric,
              timeframe: timeframe === "custom" ? fixedYear : timeframe,
            });
          }}
        >
          <h3>{editing ? "Adjust your goal" : "Make room for reading"}</h3>
          <fieldset disabled={busy} className="reader-goal-fields">
            <label className="reader-filter-field">
              What to count
              <select
                className={control}
                value={metric}
                onChange={(e) => setMetric(e.target.value as typeof metric)}
              >
                {Object.entries(metrics).map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label className="reader-filter-field">
              Timeframe
              <select
                className={control}
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option value="week">Each week</option>
                <option value="month">Each month</option>
                <option value="year">Each year</option>
                <option value="custom">Specific year</option>
              </select>
            </label>
            {timeframe === "custom" && (
              <label className="reader-filter-field">
                Year
                <input
                  className={control}
                  type="number"
                  min={1900}
                  max={9998}
                  required
                  value={fixedYear}
                  onChange={(e) => setFixedYear(e.target.value)}
                />
              </label>
            )}
            <label className="reader-filter-field">
              Target ({units[metric]})
              <input
                className={control}
                type="number"
                min={1}
                max={10000000}
                step={1}
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
          </fieldset>
          <p className="text-sm text-muted-foreground">
            {metric === "books"
              ? "Each finished read counts, including rereads."
              : metric === "pages"
                ? "Counts the full length of books finished in this period, not daily page logs."
                : "Counts the full duration of finished audiobooks in hours, as in Basgiath. This is separate from your reading timer."}
          </p>
          <div className="reader-goal-actions">
            <span className="text-sm text-muted-foreground">Try a target:</span>
            {(metric === "books"
              ? [6, 12, 24, 52]
              : metric === "pages"
                ? [1000, 5000, 10000]
                : [12, 24, 60]
            ).map((amount) => (
              <button
                type="button"
                className={control}
                key={amount}
                disabled={busy}
                aria-pressed={target === String(amount)}
                onClick={() => setTarget(String(amount))}
              >
                {number(amount)}
              </button>
            ))}
          </div>
          <div className="reader-goal-actions">
            <button className={control} disabled={busy}>
              <Check size={16} aria-hidden="true" />
              {editing ? "Save changes" : "Create goal"}
            </button>
            <button
              className={control}
              type="button"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setEditing(undefined);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {query.isPending && <p role="status">Loading goals…</p>}
      {query.isError && (
        <p role="alert">
          Goals could not load. <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {save.isError && (
        <p role="alert">
          Goal save could not be confirmed.{" "}
          <button className={control} onClick={() => save.variables && save.mutate(save.variables)}>
            Retry same save
          </button>
        </p>
      )}
      {!!remove.message && <p role="status">{remove.message}</p>}
      {remove.uncertain && (
        <button className={control} onClick={remove.retry}>
          Retry deletion
        </button>
      )}
      <div className="reader-goal-grid">
        {query.data?.map((goal) => {
          const metric = goal.metric as keyof typeof metrics;
          const progress = goal.progress;
          const Icon = metric === "books" ? BookOpen : metric === "pages" ? FileText : Clock;
          return (
            <article className="reader-goal-card" key={goal.id}>
              <header>
                <span className="reader-goal-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3>{metrics[metric]}</h3>
                  <p className="text-sm text-muted-foreground">
                    {goal.timeframe === "week"
                      ? "Weekly · Sunday–Saturday"
                      : goal.timeframe === "month"
                        ? "Monthly"
                        : goal.timeframe === "year"
                          ? "Yearly"
                          : `${goal.timeframe} goal`}
                  </p>
                </div>
                {progress.achieved && (
                  <span className="reader-goal-achieved">
                    <Check size={16} aria-hidden="true" /> Reached
                  </span>
                )}
              </header>
              <p className="reader-goal-total">
                <strong>{number(progress.current)}</strong>
                <span>
                  of {number(goal.target)} {units[metric]}
                </span>
              </p>
              <div
                className="reader-goal-track"
                role="progressbar"
                aria-label={`${metrics[metric]} goal`}
                aria-valuemin={0}
                aria-valuemax={goal.target}
                aria-valuenow={Math.min(goal.target, progress.current)}
                aria-valuetext={`${number(progress.current)} of ${number(goal.target)} ${units[metric]}`}
              >
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <p>
                {progress.achieved
                  ? "You made it. Everything after this is a little extra."
                  : progress.upcoming
                    ? "Ready for the year ahead."
                    : progress.ended
                      ? `${number(progress.current)} ${units[metric]} recorded. Every read counts.`
                      : `${number(progress.remaining)} ${units[metric]} to go · ${progress.daysRemaining} days left`}
              </p>
              <p className="reader-goal-period">
                <CalendarDays size={15} aria-hidden="true" />
                {displayDate(progress.start)} – {displayDate(progress.end)}
              </p>
              <details className="reader-goal-detail">
                <summary>What counts toward this goal</summary>
                <p className="text-sm text-muted-foreground">
                  {metric === "books"
                    ? "Completed reads, including rereads, dated within this period."
                    : "The saved length of each completed read in this period. In-progress reading and timer sessions are separate."}{" "}
                  Dates follow {timeZone}.
                </p>
                {!!progress.undated && (
                  <p className="text-sm">
                    {progress.undated} undated {progress.undated === 1 ? "read is" : "reads are"}{" "}
                    excluded. Add a finish date in book history to place them in a period.
                  </p>
                )}
                {!!progress.missingLength && (
                  <p className="text-sm">
                    {progress.missingLength} finished{" "}
                    {progress.missingLength === 1 ? "read has" : "reads have"} no known length and
                    cannot add to this total.
                  </p>
                )}
                <ul>
                  {progress.contributions.map((read, index) => (
                    <li key={`${read.userBookId}:${index}`}>
                      <Link to="/books/$bookId" params={{ bookId: read.userBookId }}>
                        {read.title}
                      </Link>
                      <span>
                        {number(read.amount)} {units[metric]}
                      </span>
                    </li>
                  ))}
                </ul>
                {progress.contributionCount > 12 && (
                  <p className="text-sm text-muted-foreground">
                    Showing the 12 most recent of {progress.contributionCount} contributing reads.
                  </p>
                )}
                {progress.contributionCount === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Your finished reads will appear here.
                  </p>
                )}
              </details>
              <footer>
                <button
                  className={control}
                  disabled={busy}
                  onClick={() => {
                    setEditing(goal.id);
                    setAdding(false);
                    setMetric(metric);
                    setTimeframe(/^\d{4}$/.test(goal.timeframe) ? "custom" : goal.timeframe);
                    if (/^\d{4}$/.test(goal.timeframe)) setFixedYear(goal.timeframe);
                    setTarget(String(goal.target));
                    document
                      .getElementById("goals")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Pencil size={15} aria-hidden="true" /> Edit
                </button>
                <button
                  className={control}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this goal? Your reading history stays unchanged."))
                      remove.run({ type: "deleteGoal", key: crypto.randomUUID(), goalId: goal.id });
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" /> Delete
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {query.data?.length === 0 && !adding && (
        <div className="reader-goal-empty">
          <Target size={32} aria-hidden="true" />
          <h3>A goal is an invitation, not a deadline.</h3>
          <p>
            Start with a few books, a page total, or audiobook hours. You can adjust it anytime.
          </p>
          <button className={control} onClick={() => setAdding(true)}>
            Create your first goal
          </button>
        </div>
      )}
    </section>
  );
}
