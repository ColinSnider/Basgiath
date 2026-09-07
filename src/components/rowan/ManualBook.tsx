import { useState } from "react";
import type { RowanCommand } from "@/lib/rowan-fns";

export function ManualBook({ run, busy }: { run: (command: RowanCommand) => void; busy: boolean }) {
  const [format, setFormat] = useState<"book" | "ebook" | "audiobook">("book");
  const field = "rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-medium">Add a book manually</summary>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const total = String(data.get("total") ?? "");
          run({
            type: "manual",
            key: crypto.randomUUID(),
            title: String(data.get("title")).trim(),
            author: String(data.get("author") ?? "").trim(),
            format,
            total: total ? Number(total) * (format === "audiobook" ? 60 : 1) : null,
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          Title
          <input className={field} name="title" required maxLength={500} />
        </label>
        <label className="grid gap-1 text-sm">
          Author
          <input className={field} name="author" maxLength={300} />
        </label>
        <label className="grid gap-1 text-sm">
          Format
          <select
            className={field}
            value={format}
            onChange={(event) => setFormat(event.target.value as typeof format)}
          >
            <option value="book">Print</option>
            <option value="ebook">Ebook</option>
            <option value="audiobook">Audiobook</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {format === "audiobook" ? "Duration in minutes (optional)" : "Pages (optional)"}
          <input
            key={format}
            className={field}
            type="number"
            min={1}
            step={1}
            max={format === "audiobook" ? 166666 : 10000000}
            name="total"
          />
        </label>
        <button className={field} disabled={busy}>
          Save to library
        </button>
      </form>
    </details>
  );
}
