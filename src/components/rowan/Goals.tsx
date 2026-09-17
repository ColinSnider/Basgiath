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
import { rowanGoals, rowanSaveGoal, rowanLogGoal } from "@/lib/rowan-fns";
import { useAccountMutation } from "./useAccountMutation";

const metrics = {
  books: "Books finished",
  pages: "Pages in finished books",
  minutes: "Audiobook hours finished",
  unique_books: "Different books finished",
  authors: "Different authors read",
  reading_minutes: "Reading time (timer minutes)",
  reading_days: "Days with timed reading",
  custom: "Custom goal",
};
const units = {
  books: "books",
  pages: "pages",
  minutes: "hours",
  unique_books: "books",
  authors: "authors",
  reading_minutes: "minutes",
  reading_days: "days",
  custom: "units",
};
const explanations = {
  books: "Each completed read counts, including rereads, on its finish date.",
  pages: "Counts the full length of books finished in the period, not daily page logs.",
  minutes:
    "Counts finished audiobook duration in hours, preserving Basgiath targets. Separate from the reading timer.",
  unique_books: "Counts each saved book once when finished in this period, regardless of rereads.",
  authors: "Counts distinct recorded authors of books finished in this period.",
  reading_minutes:
    "Counts saved reading-timer minutes on the date each timer session ends. Works for any reading format.",
  reading_days:
    "Counts each day with a saved timer session once, even when you read multiple books that day.",
  custom:
    "Choose anything meaningful to you: chapters, new genres, book-club meetings, or another personal measure. Add dated progress below; negative entries correct mistakes.",
};
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
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
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
      title?: string;
      unit?: string;
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
            setTitle("");
            setUnit("");
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
              title,
              unit,
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
            {metric === "custom" && (
              <>
                <label className="reader-filter-field">
                  Goal name
                  <input
                    className={control}
                    required
                    maxLength={100}
                    pattern={".*\\S.*"}
                    title="Enter a goal name, not just spaces."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Explore new genres"
                  />
                </label>
                <label className="reader-filter-field">
                  Unit to count
                  <input
                    className={control}
                    required
                    maxLength={30}
                    pattern={".*\\S.*"}
                    title="Enter a unit, such as chapters or meetings."
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="genres, chapters, meetings…"
                  />
                </label>
              </>
            )}
            <label className="reader-filter-field">
              Timeframe
              <select
                className={control}
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option value="day">Each day</option>
                <option value="week">Each week</option>
                <option value="month">Each month</option>
                <option value="year">Each year</option>
                <option value="custom">Specific year</option>
                <option value="all_time">No deadline</option>
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
              Target ({metric === "custom" ? unit || "units" : units[metric]})
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
          <p className="text-sm text-muted-foreground">{explanations[metric]}</p>
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
          const unitLabel = metric === "custom" ? goal.details.unit || "units" : units[metric];
          const titleLabel =
            metric === "custom" ? goal.details.title || "Custom goal" : metrics[metric];
          const Icon = metric === "books" ? BookOpen : metric === "pages" ? FileText : Clock;
          return (
            <article className="reader-goal-card" key={goal.id}>
              <header>
                <span className="reader-goal-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3>{titleLabel}</h3>
                  <p className="text-sm text-muted-foreground">
                    {goal.timeframe === "all_time"
                      ? "No deadline"
                      : goal.timeframe === "day"
                        ? "Daily"
                        : goal.timeframe === "week"
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
                  of {number(goal.target)} {unitLabel}
                </span>
              </p>
              <div
                className="reader-goal-track"
                role="progressbar"
                aria-label={`${titleLabel} goal`}
                aria-valuemin={0}
                aria-valuemax={goal.target}
                aria-valuenow={Math.min(goal.target, progress.current)}
                aria-valuetext={`${number(progress.current)} of ${number(goal.target)} ${unitLabel}`}
              >
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <p>
                {progress.achieved
                  ? "You made it. Everything after this is a little extra."
                  : progress.upcoming
                    ? "Ready for the year ahead."
                    : progress.ended
                      ? `${number(progress.current)} ${unitLabel} recorded. Every read counts.`
                      : `${number(progress.remaining)} ${unitLabel} to go${progress.unlimited ? "" : ` · ${progress.daysRemaining} days left`}`}
              </p>
              <p className="reader-goal-period">
                <CalendarDays size={15} aria-hidden="true" />
                {progress.unlimited
                  ? "All your recorded progress"
                  : `${displayDate(progress.start)} – ${displayDate(progress.end)}`}
              </p>
              {metric === "custom" && (
                <GoalLog sessionId={sessionId} goalId={goal.id} unit={unitLabel} />
              )}
              <details className="reader-goal-detail">
                <summary>What counts toward this goal</summary>
                <p className="text-sm text-muted-foreground">
                  {explanations[metric]} Dates follow {timeZone}.
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
                      <span>
                        {read.userBookId ? (
                          <Link to="/books/$bookId" params={{ bookId: read.userBookId }}>
                            {read.title}
                          </Link>
                        ) : (
                          read.title
                        )}
                        <small className="block text-muted-foreground">
                          {new Date(read.finishedAt).toLocaleDateString(undefined, {
                            timeZone: metric === "custom" ? "UTC" : timeZone,
                          })}
                        </small>
                      </span>
                      <span>
                        {number(read.amount)} {unitLabel}
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
                    Recorded progress for this period will appear here.
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
                    setTitle(goal.details.title);
                    setUnit(goal.details.unit);
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
            Track books, authors, reading time, reading days, or a custom goal. You can adjust it
            anytime.
          </p>
          <button className={control} onClick={() => setAdding(true)}>
            Create your first goal
          </button>
        </div>
      )}
    </section>
  );
}

function GoalLog({ sessionId, goalId, unit }: { sessionId: string; goalId: string; unit: string }) {
  const cache = useQueryClient();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: (input: { key: string; date: string; amount: number; note: string }) =>
      rowanLogGoal({ data: { sessionId, goalId, ...input } }),
    onSuccess: async () => {
      setAmount("");
      setNote("");
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
  });
  return (
    <details className="reader-goal-detail">
      <summary>Add or correct progress</summary>
      <form
        className="reader-goal-editor mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mutation.isPending && !mutation.isError && Number(amount) !== 0)
            mutation.mutate({ key: crypto.randomUUID(), date, amount: Number(amount), note });
        }}
      >
        <fieldset disabled={mutation.isPending || mutation.isError} className="grid gap-3">
          <label className="reader-filter-field">
            Amount ({unit})
            <input
              className={control}
              type="number"
              step="any"
              min={-10000000}
              max={10000000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="reader-filter-field">
            Date
            <input
              className={control}
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="reader-filter-field">
            Note (optional)
            <input
              className={control}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on?"
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Use a negative amount to correct an earlier entry. Your entry history stays visible.
          </p>
          <button className={control} disabled={!amount || Number(amount) === 0}>
            Save progress
          </button>
        </fieldset>
        {mutation.isSuccess && <p role="status">Progress saved.</p>}
        {mutation.isError && (
          <p role="alert">
            Save could not be confirmed.{" "}
            <button
              type="button"
              className={control}
              onClick={() => mutation.variables && mutation.mutate(mutation.variables)}
            >
              Retry same entry
            </button>
          </p>
        )}
      </form>
    </details>
  );
}
