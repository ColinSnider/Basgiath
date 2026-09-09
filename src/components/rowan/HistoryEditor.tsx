import { useState } from "react";
import { effectiveProgress } from "../../../shared/reading-progress";
import type { rowanHistory, RowanCommand } from "@/lib/rowan-fns";

type History = Awaited<ReturnType<typeof rowanHistory>>;
type Entry = History["entries"][number];
const control = "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
const unitName = (unit: string) => unit === "page" ? "pages" : unit === "second" ? "seconds" : "%";
function localInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

export function HistoryEditor({ history, busy, run }: { history: History; busy: boolean; run: (command: RowanCommand) => void }) {
  return <section className="space-y-4" aria-label="Reading history editor">
    <h3 className="font-display text-2xl">Reading history</h3>
    <p className="text-sm text-muted-foreground">Correct a mistaken position or date, or remove an accidental log. Originals remain in your correction history. Dates use this device’s time zone.</p>
    {!history.sessions.length && <p>No reading attempts yet.</p>}
    {history.sessions.map(session => {
      const entries = history.entries.filter(entry => entry.sessionId === session.id);
      const current = effectiveProgress(entries);
      const replaced = new Set(entries.map(entry => entry.supersedesId));
      return <section key={session.id} className="space-y-3 rounded-xl border border-border p-4">
        <h4 className="font-medium">{session.state} · {session.startedAt ? new Date(session.startedAt).toLocaleDateString() : "Unknown start"}{session.finishedAt ? ` — ${new Date(session.finishedAt).toLocaleDateString()}` : ""}</h4>
        <p className="text-sm">{session.loggedProgress} {unitName(session.unit)} logged from recorded positions. Completion alone adds no activity.</p>
        <ul className="space-y-3">
          {current.map(entry => <li key={entry.id}>
            <p className="text-sm">{entry.kind === "baseline" ? "Starting position" : "Progress"}: {entry.position} {unitName(session.unit)} · {entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : "Unknown date"}{entry.supersedesId ? " · corrected" : ""}</p>
            {entry.kind === "observation" && <CorrectionForm entry={entry} session={session} busy={busy} run={run} />}
          </li>)}
        </ul>
        {entries.some(entry => entry.supersedesId) && <details className="text-sm">
          <summary className="cursor-pointer">Correction history · originals retained</summary>
          <ul className="mt-3 space-y-2">
            {entries.filter(entry => entry.supersedesId || replaced.has(entry.id)).map(entry => <li key={entry.id}>
              <strong>{entry.voided ? "Removed" : replaced.has(entry.id) ? "Superseded" : "Corrected"}</strong>: {entry.position} {unitName(session.unit)} · {entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : "Unknown date"}
              {entry.correctionReason && <p>{entry.correctionReason}</p>}
              <p className="text-muted-foreground">Recorded {new Date(entry.createdAt).toLocaleString()}</p>
            </li>)}
          </ul>
        </details>}
      </section>;
    })}
  </section>;
}

function CorrectionForm({ entry, session, busy, run }: { entry: Entry; session: History["sessions"][number]; busy: boolean; run: (command: RowanCommand) => void }) {
  const initial = localInput(entry.occurredAt!);
  const [position, setPosition] = useState(String(entry.position));
  const [date, setDate] = useState(initial);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"correct" | "remove">("correct");
  const [error, setError] = useState("");
  return <details className="mt-2">
    <summary className="cursor-pointer text-sm underline">Correct or remove this entry</summary>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event => {
      event.preventDefault();
      setError("");
      const parsedDate = new Date(date);
      if (action === "correct" && !Number.isFinite(parsedDate.getTime())) { setError("Enter a valid date and time."); return; }
      const timestamp = action === "remove" || date === initial ? entry.occurredAt! : parsedDate.toISOString();
      const value = Number(position);
      if (!Number.isInteger(value) || value < 0) { setError("Enter a whole-number position."); return; }
      run({ type: "correctProgress", key: crypto.randomUUID(), sessionId: session.id, entryId: entry.id,
        expectedVersion: session.version, action, position: value, occurredAt: timestamp, reason: reason.trim() });
    }}>
      <label className="text-sm">Action<select className={`${control} block`} value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="correct">Correct entry</option><option value="remove">Remove entry</option></select></label>
      {action === "correct" && <>
        <label className="text-sm">Position ({unitName(session.unit)})<input className={`${control} block w-32`} type="number" min={0} max={session.total ?? undefined} step={1} required value={position} onChange={e => setPosition(e.target.value)} /></label>
        <label className="text-sm">Observed at<input className={`${control} block`} type="datetime-local" step={1} required value={date} onChange={e => setDate(e.target.value)} /></label>
      </>}
      <label className="text-sm">Reason<input className={`${control} block`} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="What needs correcting?" /></label>
      <button className={control} disabled={busy || !reason.trim()}>{action === "remove" ? "Confirm removal" : "Save correction"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
}
