import { useState } from "react";
import { BookOpen, Headphones } from "lucide-react";
import type { RowanCommand, rowanHistory } from "@/lib/rowan-fns";

type History = Awaited<ReturnType<typeof rowanHistory>>;
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-base disabled:opacity-50";

export function StartReadForm({
  userBookId,
  history,
  busy,
  run,
}: {
  userBookId: string;
  history: History;
  busy: boolean;
  run: (command: RowanCommand) => void;
}) {
  const previous = history.edition;
  const [format, setFormat] = useState<"book" | "ebook" | "audiobook">(
    previous?.format === "audiobook"
      ? "audiobook"
      : previous?.format === "ebook"
        ? "ebook"
        : "book",
  );
  const [percent, setPercent] = useState(false);
  const audio = format === "audiobook";
  const sameFormat = format === previous?.format;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const length = String(data.get("length") ?? "");
        run({
          type: "start",
          key: crypto.randomUUID(),
          userBookId,
          expectedVersion: history.userBookVersion,
          startedAt: new Date().toISOString(),
          position: 0,
          unit: percent ? "percent" : audio ? "second" : "page",
          edition: { format, total: length ? Math.round(Number(length) * (audio ? 60 : 1)) : null },
        });
      }}
    >
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Format for this read
          <select
            className={control}
            value={format}
            onChange={(event) => setFormat(event.target.value as typeof format)}
          >
            <option value="book">Print book</option>
            <option value="ebook">Ebook</option>
            <option value="audiobook">Audiobook</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {audio ? "Duration in minutes (optional)" : "Pages in this edition (optional)"}
          <input
            key={format}
            className={`${control} min-w-0 w-full`}
            name="length"
            type="number"
            min={audio ? 1 / 60 : 1}
            max={audio ? 35791394 : 2147483647}
            step={audio ? "any" : 1}
            placeholder="Unknown"
            defaultValue={
              sameFormat
                ? audio
                  ? previous?.durationSeconds
                    ? previous.durationSeconds / 60
                    : ""
                  : (previous?.pageCount ?? "")
                : ""
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={percent}
            onChange={(event) => setPercent(event.target.checked)}
          />
          Track progress as a percentage
        </label>
      </fieldset>
      <button className="reader-button" disabled={busy}>
        {audio ? (
          <Headphones size={16} aria-hidden="true" />
        ) : (
          <BookOpen size={16} aria-hidden="true" />
        )}
        {history.sessions.length ? "Start reread" : audio ? "Start listening" : "Start reading"}
      </button>
      {history.sessions.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Earlier reads keep their original format, length, and history.
        </p>
      )}
    </form>
  );
}
