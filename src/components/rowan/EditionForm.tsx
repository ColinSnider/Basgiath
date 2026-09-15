import { useState } from "react";
import type { RowanCommand, rowanHistory } from "@/lib/rowan-fns";

export function EditionForm({
  userBookId,
  history,
  run,
  busy,
}: {
  userBookId: string;
  history: Awaited<ReturnType<typeof rowanHistory>>;
  run: (command: RowanCommand) => void;
  busy: boolean;
}) {
  const [format, setFormat] = useState<"book" | "ebook" | "audiobook">(
    history.edition?.format === "audiobook"
      ? "audiobook"
      : history.edition?.format === "ebook"
        ? "ebook"
        : "book",
  );
  const control = "rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer">Your format and edition length</summary>
      <p className="my-3 text-sm text-muted-foreground">
        These details apply when you start your next reading session. Existing sessions keep their
        original format and length.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const length = String(new FormData(event.currentTarget).get("total") ?? "");
          run({
            type: "edition",
            key: crypto.randomUUID(),
            userBookId,
            expectedVersion: history.userBookVersion,
            format,
            total: length ? Number(length) * (format === "audiobook" ? 60 : 1) : null,
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          Format
          <select
            className={control}
            value={format}
            onChange={(event) => setFormat(event.target.value as typeof format)}
          >
            <option value="book">Print</option>
            <option value="ebook">Ebook</option>
            <option value="audiobook">Audiobook</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {format === "audiobook" ? "Minutes" : "Pages"}
          <input
            key={format}
            className={control}
            name="total"
            type="number"
            min={1}
            step={1}
            max={format === "audiobook" ? 166666 : 10000000}
            defaultValue={
              format === "audiobook"
                ? history.edition?.durationSeconds
                  ? history.edition.durationSeconds / 60
                  : ""
                : (history.edition?.pageCount ?? "")
            }
          />
        </label>
        <button className={control} disabled={busy}>
          Save edition
        </button>
      </form>
    </details>
  );
}
