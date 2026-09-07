import { useEffect, useState } from "react";
import type { rowanHistory, RowanCommand } from "@/lib/rowan-fns";

type Margin = Awaited<ReturnType<typeof rowanHistory>>["margins"][number];
type Actions = { userBookId: string; busy: boolean; run: (command: RowanCommand) => void };
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";

export function Margins({ margins, ...actions }: Actions & { margins: Margin[] }) {
  return (
    <section className="space-y-4" aria-label="Your margins">
      <div>
        <h3 className="font-display text-2xl">Margins</h3>
        <p className="text-sm text-muted-foreground">
          Keep a thought, a quote, or something you want to return to. Only you can see these.
        </p>
      </div>
      <MarginEditor savedIds={margins.map((m) => m.id)} {...actions} />
      {margins.length === 0 && (
        <p className="text-sm text-muted-foreground">Your first margin can be just a sentence.</p>
      )}
      <ul className="space-y-3">
        {margins.map((margin) => (
          <MarginCard key={margin.id} margin={margin} {...actions} />
        ))}
      </ul>
    </section>
  );
}

function MarginCard({ margin, ...actions }: Actions & { margin: Margin }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <li className="rounded-xl border border-border p-4 space-y-3">
      {editing ? (
        <MarginEditor margin={margin} {...actions} cancel={() => setEditing(false)} />
      ) : (
        <>
          {margin.locator && <p className="text-xs text-primary">{margin.locator}</p>}
          <p className="whitespace-pre-wrap break-words">{margin.body}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(margin.updatedAt).toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            <button className={control} disabled={actions.busy} onClick={() => setEditing(true)}>
              Edit margin
            </button>
            <button className={control} disabled={actions.busy} onClick={() => setDeleting(true)}>
              Delete margin
            </button>
          </div>
        </>
      )}
      {deleting && (
        <div className="space-y-2">
          <p>Remove this margin from your book?</p>
          <div className="flex gap-2">
            <button
              className={control}
              disabled={actions.busy}
              onClick={() =>
                actions.run({
                  type: "margin",
                  key: crypto.randomUUID(),
                  userBookId: actions.userBookId,
                  marginId: margin.id,
                  expectedVersion: margin.version,
                  action: "delete",
                })
              }
            >
              Confirm deletion
            </button>
            <button className={control} disabled={actions.busy} onClick={() => setDeleting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function MarginEditor({
  margin,
  cancel,
  savedIds,
  ...actions
}: Actions & { margin?: Margin; cancel?: () => void; savedIds?: string[] }) {
  const [body, setBody] = useState(margin?.body ?? "");
  const [locator, setLocator] = useState(margin?.locator ?? "");
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  useEffect(() => {
    if (submittedId && savedIds?.includes(submittedId)) {
      setBody("");
      setLocator("");
      setSubmittedId(null);
    }
  }, [submittedId, savedIds]);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const marginId = margin?.id ?? crypto.randomUUID();
        if (!margin) setSubmittedId(marginId);
        actions.run({
          type: "margin",
          key: crypto.randomUUID(),
          userBookId: actions.userBookId,
          marginId,
          expectedVersion: margin?.version ?? null,
          action: "save",
          body: body.trim(),
          locator: locator.trim() || null,
        });
      }}
    >
      <label className="block text-sm">
        {margin ? "Edit your margin" : "Write a margin"}
        <textarea
          className={`${control} mt-1 block min-h-28 w-full`}
          maxLength={10000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={actions.busy}
        />
      </label>
      <label className="block text-sm">
        Location (optional)
        <input
          className={`${control} ml-2`}
          placeholder="Page 42, chapter 3, or 01:25:00"
          maxLength={120}
          value={locator}
          onChange={(e) => setLocator(e.target.value)}
          disabled={actions.busy}
        />
      </label>
      <div className="flex gap-2">
        <button className={control} disabled={actions.busy || !body.trim()}>
          {margin ? "Save changes" : "Add margin"}
        </button>
        {cancel && (
          <button type="button" className={control} disabled={actions.busy} onClick={cancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
