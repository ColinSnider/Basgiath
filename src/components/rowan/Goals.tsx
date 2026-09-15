import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rowanGoals, rowanSaveGoal } from "@/lib/rowan-fns";
import { useAccountMutation } from "./useAccountMutation";

export function Goals({ sessionId }: { sessionId: string }) {
  const cache = useQueryClient();
  const [metric, setMetric] = useState<"books" | "pages" | "minutes">("books");
  const [timeframe, setTimeframe] = useState<string>("year");
  const [editing, setEditing] = useState<string | undefined>();
  const [target, setTarget] = useState("");
  const remove = useAccountMutation(sessionId);
  const query = useQuery({
    queryKey: ["rowan", sessionId, "goals"],
    queryFn: () => rowanGoals({ data: { sessionId } }),
  });
  const save = useMutation({
    mutationFn: (input: {
      key: string;
      id?: string;
      target: number;
      metric: typeof metric;
      timeframe: typeof timeframe;
    }) => rowanSaveGoal({ data: { sessionId, ...input } }),
    onSuccess: async () => {
      setEditing(undefined);
      setTarget("");
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
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
          if (value > 0)
            save.mutate({
              key: crypto.randomUUID(),
              id: editing,
              target: value,
              metric,
              timeframe,
            });
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
            {!["week", "month", "year"].includes(timeframe) && (
              <option value={timeframe}>{timeframe}</option>
            )}
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Target
          <input
            className={control}
            name="target"
            type="number"
            min={1}
            max={10000000}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </label>
        <button className={control} disabled={save.isPending || save.isError || remove.busy}>
          {editing ? "Update goal" : "Save goal"}
        </button>
        {editing && (
          <button
            type="button"
            className={control}
            onClick={() => {
              setEditing(undefined);
              setTarget("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {query.isPending && <p role="status">Loading goals…</p>}
      {query.isError && (
        <p role="alert">
          Goals could not load. <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {save.isError && (
        <p role="alert">
          Goal save could not be confirmed.{" "}
          <button
            className={control}
            disabled={save.isPending}
            onClick={() => save.variables && save.mutate(save.variables)}
          >
            Retry same save
          </button>
        </p>
      )}
      <p role="status">{remove.message}</p>
      {remove.uncertain && (
        <button className={control} onClick={remove.retry}>
          Retry deletion
        </button>
      )}
      {query.data?.map((goal) => (
        <div
          className="flex items-center justify-between rounded-lg bg-background p-3"
          key={goal.id}
        >
          <span>
            {goal.target} {goal.metric} per {goal.timeframe}
          </span>
          <div className="flex gap-2">
            <button
              className={control}
              disabled={save.isPending || remove.busy}
              onClick={() => {
                setEditing(goal.id);
                setMetric(goal.metric as typeof metric);
                setTimeframe(goal.timeframe as typeof timeframe);
                setTarget(String(goal.target));
              }}
            >
              Edit
            </button>
            <button
              className={control}
              disabled={save.isPending || remove.busy}
              onClick={() => {
                if (window.confirm("Delete this reading goal?"))
                  remove.run({ type: "deleteGoal", key: crypto.randomUUID(), goalId: goal.id });
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      {query.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No goals set yet.</p>
      )}
    </section>
  );
}
