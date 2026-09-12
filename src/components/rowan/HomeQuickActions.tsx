import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rowanMutate, type rowanHome, type RowanCommand } from "@/lib/rowan-fns";

type Current = Awaited<ReturnType<typeof rowanHome>>["current"][number];
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";

export function HomeQuickActions({ sessionId, item }: { sessionId: string; item: Current }) {
  const cache = useQueryClient();
  const [editor, setEditor] = useState<"progress" | "margin" | "finish" | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<RowanCommand | null>(null);
  const mutation = useMutation({
    mutationFn: (command: RowanCommand) => rowanMutate({ data: { sessionId, command } }),
    onSuccess: async (result) => {
      pending.current = null;
      setNotice(result.ok ? "Saved." : result.message);
      if (result.ok) setEditor(null);
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
    onError: () => setNotice("Save could not be confirmed. Retry to safely confirm it."),
  });
  const busy = mutation.isPending || !!pending.current;
  function run(command: RowanCommand) {
    if (busy) return;
    pending.current = command;
    setNotice("");
    mutation.mutate(command);
  }
  const transition = (action: "pause" | "resume" | "finish") =>
    run({
      type: "transition",
      key: crypto.randomUUID(),
      sessionId: item.sessionId,
      expectedVersion: item.version,
      occurredAt: new Date().toISOString(),
      action,
    });
  const max = item.unit === "percent" ? 100 : (item.total ?? undefined);
  return (
    <section className="mt-3 space-y-3" aria-label={`Quick actions for ${item.book.title}`}>
      <div className="flex flex-wrap gap-2">
        <button
          className={control}
          disabled={busy || item.state !== "active"}
          onClick={() => setEditor(editor === "progress" ? null : "progress")}
        >
          Update progress
        </button>
        <button
          className={control}
          disabled={busy}
          onClick={() => setEditor(editor === "margin" ? null : "margin")}
        >
          Add margin
        </button>
        <button
          className={control}
          disabled={busy}
          onClick={() => transition(item.state === "paused" ? "resume" : "pause")}
        >
          {item.state === "paused" ? "Resume" : "Pause"}
        </button>
        <button
          className={control}
          disabled={busy || (!item.timerStartedAt && item.state !== "active")}
          onClick={() =>
            run({
              type: "timer",
              key: crypto.randomUUID(),
              sessionId: item.sessionId,
              expectedVersion: item.version,
              action: item.timerStartedAt ? "stop" : "start",
            })
          }
        >
          {item.timerStartedAt ? "Stop & save timer" : "Start timer"}
        </button>
        <button className={control} disabled={busy} onClick={() => setEditor("finish")}>
          Finish
        </button>
      </div>
      {editor === "progress" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run({
              type: "progress",
              key: crypto.randomUUID(),
              sessionId: item.sessionId,
              expectedVersion: item.version,
              occurredAt: new Date().toISOString(),
              position: Number(form.get("position")),
            });
          }}
        >
          <label className="text-sm">
            Current{" "}
            {item.unit === "page"
              ? "page"
              : item.unit === "second"
                ? "audio position (seconds)"
                : "percentage"}
            <input
              key={item.version}
              name="position"
              className={`${control} block w-32`}
              type="number"
              required
              step="1"
              min={item.position}
              max={max}
              defaultValue={item.position}
              disabled={busy}
            />
          </label>
          <button className={control} disabled={busy || item.state !== "active"}>
            Save progress
          </button>
          <p className="text-xs text-muted-foreground w-full">
            Reaching the end won't automatically finish this book.
          </p>
        </form>
      )}
      {editor === "margin" && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run({
              type: "margin",
              key: crypto.randomUUID(),
              userBookId: item.book.id,
              marginId: crypto.randomUUID(),
              expectedVersion: null,
              action: "save",
              kind: form.get("kind") === "quote" ? "quote" : "note",
              body: String(form.get("body")),
              locator: String(form.get("locator")).trim() || null,
            });
          }}
        >
          <label className="block text-sm">
            Type{" "}
            <select name="kind" className={control} disabled={busy}>
              <option value="note">Note</option>
              <option value="quote">Quote</option>
            </select>
          </label>
          <label className="block text-sm">
            Your margin
            <textarea
              name="body"
              className={`${control} block w-full`}
              required
              maxLength={10000}
              rows={3}
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            Page or location (optional)
            <input
              name="locator"
              className={`${control} block w-full`}
              maxLength={120}
              disabled={busy}
            />
          </label>
          <button className={control} disabled={busy}>
            Save margin
          </button>
        </form>
      )}
      {editor === "finish" && (
        <div className="space-y-2">
          <p>Mark {item.book.title} as finished today?</p>
          <button className={control} disabled={busy} onClick={() => transition("finish")}>
            Confirm finish
          </button>
        </div>
      )}
      {editor && (
        <button className="text-sm underline" disabled={busy} onClick={() => setEditor(null)}>
          Cancel
        </button>
      )}
      <p role="status" className="text-sm">
        {notice}
      </p>
      {mutation.isError && pending.current && (
        <button
          className={control}
          disabled={mutation.isPending}
          onClick={() => pending.current && mutation.mutate(pending.current)}
        >
          Retry save
        </button>
      )}
    </section>
  );
}
