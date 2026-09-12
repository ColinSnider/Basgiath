import { useState } from "react";
import type { rowanHistory } from "@/lib/rowan-fns";
import { metadataSchema } from "../../../shared/rowan-archive";
import { useAccountMutation } from "./useAccountMutation";

const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
export function BookEditor({
  sessionId,
  book,
  history,
  close,
}: {
  sessionId: string;
  book: { id: string; title: string; authors: string[]; coverUrl: string | null };
  history: Awaited<ReturnType<typeof rowanHistory>>;
  close: () => void;
}) {
  const edit = useAccountMutation(sessionId);
  const deletion = useAccountMutation(sessionId, close);
  const [error, setError] = useState("");
  const busy = edit.busy || deletion.busy;
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer">Edit book details</summary>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const fields = new FormData(event.currentTarget);
          try {
            const metadata = metadataSchema.parse({ ...history.metadata });
            metadata.description = String(fields.get("description")).trim();
            edit.run({
              type: "editBook",
              key: crypto.randomUUID(),
              userBookId: book.id,
              expectedVersion: history.userBookVersion,
              title: String(fields.get("title")),
              authors: String(fields.get("authors"))
                .split("\n")
                .map((a) => a.trim())
                .filter(Boolean),
              coverUrl: String(fields.get("coverUrl")).trim() || null,
              metadata,
            });
          } catch {
            setError("Metadata must be a valid JSON object.");
          }
        }}
      >
        <label className="grid gap-1">
          Title
          <input
            className={control}
            name="title"
            defaultValue={book.title}
            required
            maxLength={500}
          />
        </label>
        <label className="grid gap-1">
          Authors (one per line)
          <textarea className={control} name="authors" defaultValue={book.authors.join("\n")} />
        </label>
        <label className="grid gap-1">
          Cover URL
          <input
            className={control}
            name="coverUrl"
            type="url"
            defaultValue={book.coverUrl ?? ""}
          />
        </label>
        <label className="grid gap-1">
          About this book
          <textarea
            className={control}
            name="description"
            rows={5}
            maxLength={10000}
            defaultValue={
              typeof history.metadata.description === "string" ? history.metadata.description : ""
            }
            placeholder="Synopsis or your own description"
          />
        </label>
        <button className={control} disabled={busy}>
          Save book details
        </button>
      </form>
      <p role="status">{error || edit.message || deletion.message}</p>
      {edit.uncertain && (
        <button className={control} onClick={edit.retry}>
          Retry save
        </button>
      )}
      {deletion.uncertain && (
        <button className={control} onClick={deletion.retry}>
          Retry deletion
        </button>
      )}
      <button
        className={`${control} mt-4 text-destructive`}
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              `Permanently delete “${book.title}” and its reading history and margins from Rowan? The legacy copy remains, but will not be imported again automatically.`,
            )
          )
            deletion.run({
              type: "deleteBook",
              key: crypto.randomUUID(),
              userBookId: book.id,
              expectedVersion: history.userBookVersion,
            });
        }}
      >
        Delete book permanently
      </button>
    </details>
  );
}
