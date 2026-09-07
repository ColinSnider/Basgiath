import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rowanGoals, rowanSaveGoal } from "@/lib/rowan-fns";

export function Goals({ sessionId }: { sessionId: string }) {
  const cache = useQueryClient();
  const [metric, setMetric] = useState<"books" | "pages" | "minutes">("books");
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">("year");
  const query = useQuery({
    queryKey: ["rowan", sessionId, "goals"],
    queryFn: () => rowanGoals({ data: { sessionId } }),
  });
  const save = useMutation({
    mutationFn: (target: number) =>
      rowanSaveGoal({ data: { sessionId, key: crypto.randomUUID(), metric, timeframe, target } }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["rowan", sessionId, "goals"] }),
  });
  const control = "rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <section id="goals" className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-display text-2xl">Reading goals</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = Number(new FormData(event.currentTarget).get("target"));
          if (value > 0) save.mutate(value);
        }}
      >
        <label className="grid gap-1 text-sm">
          Measure
          <select
            className={control}
            value={metric}
            onChange={(event) => setMetric(event.target.value as typeof metric)}
          >
            <option value="books">Books</option>
            <option value="pages">Pages</option>
            <option value="minutes">Audiobook minutes</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Timeframe
          <select
            className={control}
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value as typeof timeframe)}
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Target
          <input className={control} name="target" type="number" min={1} required />
        </label>
        <button className={control} disabled={save.isPending}>
          Save goal
        </button>
      </form>
      {query.isPending && <p role="status">Loading goals…</p>}
      {query.data?.map((goal) => (
        <div
          className="flex items-center justify-between rounded-lg bg-background p-3"
          key={goal.id}
        >
          <span>
            {goal.target} {goal.metric} per {goal.timeframe}
          </span>
          <span className="text-sm text-muted-foreground">
            Progress tracking connected to reading history
          </span>
        </div>
      ))}
      {query.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No goals set yet.</p>
      )}
    </section>
  );
}
