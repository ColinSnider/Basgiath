import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rowanLibrary, rowanMutate } from "@/lib/rowan-fns";
import { backlogImport } from "../../../shared/backlog";
import { csvFields, mapCsvRow, parseCsv, type CsvField } from "../../../shared/csv-backlog";
import type { z } from "zod";
type Row = z.infer<typeof backlogImport>["rows"][number];
const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";
const labels: Record<CsvField, string> = {
  title: "Book title",
  author: "Author",
  format: "Reading format",
  total: "Book length — pages / audio seconds",
  reads: "Completed reads",
  startedAt: "Start date",
  finishedAt: "Finish date",
};
export function CsvImport({
  sessionId,
  disabled = false,
  onBusyChange,
}: {
  sessionId: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const cache = useQueryClient();
  const [csv, setCsv] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CsvField, number>>>({});
  const [style, setStyle] = useState<"iso" | "mdy" | "dmy">("iso");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef<z.infer<typeof backlogImport> | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: z.infer<typeof backlogImport>) =>
      rowanMutate({ data: { sessionId, command: { type: "backlogImport", payload } } }),
    onSuccess: async (result) => {
      pending.current = null;
      if (!result.ok) setError(result.message);
      else {
        setRows(null);
        setCsv(null);
        setNotice("CSV imported. Review or edit the reads in each book’s History tab.");
      }
      await cache.invalidateQueries({ queryKey: ["rowan", sessionId] });
    },
    onError: () => setError("Import result is uncertain. Retry this same import safely."),
  });
  const ownBusy = loading || mutation.isPending || !!pending.current;
  const busy = disabled || ownBusy;
  useEffect(() => {
    onBusyChange?.(ownBusy);
  }, [ownBusy, onBusyChange]);
  const books = useQuery({
    queryKey: ["rowan", sessionId, "csv-book-choices"],
    enabled: !!rows,
    queryFn: async () => {
      const items: Awaited<ReturnType<typeof rowanLibrary>>["items"] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page: Awaited<ReturnType<typeof rowanLibrary>> = await rowanLibrary({
          data: { sessionId, offset, query: "", status: "all", sort: "title" },
        });
        items.push(...page.items);
        offset = page.nextOffset;
      }
      return items;
    },
  });
  return (
    <section className="reader-csv-import space-y-4" aria-label="Import CSV reading list">
      <ol className="reader-import-steps" aria-label="Import progress">
        {["Choose file", "Map columns", "Review & import"].map((label, index) => (
          <li key={label} aria-current={(rows ? 2 : csv ? 1 : 0) === index ? "step" : undefined}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <p className="reader-muted">
        Map your columns, then review. New books are added; existing books stay. Dates apply to one
        completed read; extra reads have unknown dates. Book length means the full page count for
        print/ebooks, or the full duration in seconds for audiobooks—not your current progress.
      </p>
      <label className="reader-file-label reader-import-file">
        <span className="flex items-center gap-2">
          <FileSpreadsheet size={20} aria-hidden="true" /> Choose a CSV reading list
        </span>
        <span className="reader-muted text-sm">Up to 2 MB · 500 books</span>
        <input
          className="block max-w-full"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setLoading(true);
            setError("");
            setNotice("");
            setRows(null);
            setCsv(null);
            try {
              if (file.size > 2_000_000) throw new Error("CSV must be under 2 MB.");
              const data = parseCsv(await file.text());
              setCsv(data);
              const next: Partial<Record<CsvField, number>> = {};
              csvFields.forEach((field) => {
                const index = data[0].findIndex(
                  (h) => h.toLowerCase().replace(/[^a-z]/g, "") === field.toLowerCase(),
                );
                if (index >= 0) next[field] = index;
              });
              setMapping(next);
            } catch (e) {
              setError(e instanceof Error ? e.message : "CSV could not load.");
            } finally {
              setLoading(false);
            }
          }}
        />
      </label>
      {csv && !rows && (
        <div className="reader-restore-review space-y-3">
          <p>
            {csv.length - 1} rows found. Title is required. Formats: book, ebook, audiobook. Blank
            read count defaults to one with dates, otherwise zero.
          </p>
          <div className="reader-import-mapping">
            {csvFields.map((field) => (
              <label key={field}>
                {labels[field]}
                <select
                  className={`${control} block max-w-full`}
                  value={mapping[field] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      [field]: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Not mapped</option>
                  {csv[0].map((heading, index) => (
                    <option key={index} value={index}>
                      {heading || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label>
            Date format
            <select
              className={control}
              value={style}
              onChange={(e) => setStyle(e.target.value as typeof style)}
            >
              <option value="iso">YYYY-MM-DD</option>
              <option value="mdy">MM/DD/YYYY</option>
              <option value="dmy">DD/MM/YYYY</option>
            </select>
          </label>
          <button
            className="reader-button"
            disabled={busy || mapping.title === undefined}
            onClick={() => {
              setError("");
              try {
                setRows(
                  csv.slice(1).map((row, index) => {
                    try {
                      return mapCsvRow(row, mapping, style);
                    } catch (e) {
                      throw new Error(
                        `Row ${index + 2}: ${e instanceof Error ? e.message : "Invalid values"}`,
                      );
                    }
                  }),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Check columns.");
              }
            }}
          >
            Review import
          </button>
        </div>
      )}
      {rows && (
        <div className="reader-restore-review space-y-3">
          <h4>
            <CheckCircle2 size={18} className="inline mr-2" aria-hidden="true" />
            Review {rows.length} books · {rows.reduce((n, row) => n + row.reads, 0)} completed reads
            to add
          </h4>
          <p>
            Choose an existing book to append reads to it; otherwise a new book is created. Matching
            is never automatic. Existing book details are preserved.
          </p>
          {books.isError && (
            <p role="alert">
              Existing books could not load.{" "}
              <button onClick={() => void books.refetch()}>Retry</button>
            </p>
          )}
          <div className="max-h-96 overflow-auto space-y-3">
            {rows.map((row, index) => (
              <fieldset
                key={index}
                className="border border-border rounded-lg p-3 space-y-2"
                disabled={busy}
              >
                <legend>Row {index + 1}</legend>
                <select
                  aria-label={`Destination for row ${index + 1}`}
                  className={`${control} max-w-full`}
                  value={row.userBookId ?? ""}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, i) =>
                        i === index ? { ...r, userBookId: e.target.value || undefined } : r,
                      ),
                    )
                  }
                >
                  <option value="">Create new book</option>
                  {books.data?.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title} — {book.authors.join(", ")}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  {(["title", "author"] as const).map((field) => (
                    <label key={field}>
                      {field}
                      <input
                        className={`${control} block`}
                        value={row[field]}
                        disabled={!!row.userBookId}
                        onChange={(e) =>
                          setRows(
                            rows.map((r, i) =>
                              i === index ? { ...r, [field]: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Reads to add
                    <input
                      className={`${control} block w-24`}
                      type="number"
                      min={0}
                      max={100}
                      value={row.reads}
                      onChange={(e) =>
                        setRows(
                          rows.map((r, i) =>
                            i === index ? { ...r, reads: Number(e.target.value) } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  {(["startedAt", "finishedAt"] as const).map((field) => (
                    <label key={field}>
                      {field === "startedAt" ? "Start" : "Finish"}
                      <input
                        className={`${control} block`}
                        type="date"
                        value={
                          row[field]
                            ? new Date(
                                new Date(row[field]!).getTime() -
                                  new Date(row[field]!).getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 10)
                            : ""
                        }
                        onChange={(e) =>
                          setRows(
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    [field]: e.target.value
                                      ? new Date(`${e.target.value}T12:00:00`).toISOString()
                                      : null,
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="text-sm">
                  {row.format} · {row.total ?? "Unknown"}{" "}
                  {row.format === "audiobook" ? "seconds" : "pages"}
                </p>
                <button
                  type="button"
                  className={control}
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                >
                  Exclude this row
                </button>
              </fieldset>
            ))}
          </div>
          <button
            className="reader-button"
            disabled={busy || books.isPending || books.isError || !rows.length}
            onClick={() => {
              setError("");
              const parsed = backlogImport.safeParse({ key: crypto.randomUUID(), rows });
              if (!parsed.success) {
                setError(
                  parsed.error.issues
                    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                    .join(" · "),
                );
                return;
              }
              pending.current = parsed.data;
              mutation.mutate(parsed.data);
            }}
          >
            Confirm import
          </button>
          <button className={control} disabled={busy} onClick={() => setRows(null)}>
            Back to mapping
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {mutation.isError && pending.current && (
        <button
          className={control}
          disabled={mutation.isPending}
          onClick={() => pending.current && mutation.mutate(pending.current)}
        >
          Retry same import
        </button>
      )}
    </section>
  );
}
