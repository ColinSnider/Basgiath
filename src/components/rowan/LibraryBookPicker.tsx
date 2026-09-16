import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { rowanLibrary } from "@/lib/rowan-fns";

const control =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50";

/** Search only the page needed, rather than loading every book for a select. */
export function LibraryBookPicker({
  sessionId,
  value,
  onChange,
  label,
  emptyLabel,
  disabled = false,
}: {
  sessionId: string;
  value: string;
  onChange: (id: string) => void;
  label: string;
  emptyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setOffset(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["rowan", sessionId, "book-picker", term, offset],
    enabled: open && !disabled,
    queryFn: () =>
      rowanLibrary({ data: { sessionId, query: term, offset, status: "all", sort: "title" } }),
  });
  function choose(id: string, title = "") {
    onChange(id);
    setTitle(title);
    setOpen(false);
    setSearch("");
    setOffset(0);
  }
  return (
    <div className="reader-book-picker">
      <button
        type="button"
        className={control}
        aria-label={`${label}: ${value ? title : emptyLabel}`}
        aria-expanded={open && !disabled}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span>{value ? title || "Selected book" : emptyLabel}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div
          className="reader-book-picker-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <label className="reader-filter-field">
            <span>
              <Search size={14} className="inline mr-1" aria-hidden="true" />
              {label}
            </span>
            <input
              autoFocus
              className={control}
              placeholder="Search title or author…"
              value={search}
              maxLength={200}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className={control} onClick={() => choose("")}>
            {emptyLabel}
          </button>
          {query.isFetching && <p role="status">Finding books…</p>}
          {query.isError && (
            <p role="alert">
              Books could not load.{" "}
              <button type="button" onClick={() => void query.refetch()}>
                Retry
              </button>
            </p>
          )}
          <ul>
            {query.data?.items.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  disabled={term !== search}
                  aria-pressed={value === book.id}
                  onClick={() => choose(book.id, book.title)}
                >
                  <strong>{book.title}</strong>
                  <small>{book.authors.join(", ")}</small>
                </button>
              </li>
            ))}
          </ul>
          {query.data?.total === 0 && <p>No matching books.</p>}
          <footer>
            <button
              type="button"
              className={control}
              disabled={!offset || query.isFetching || term !== search}
              onClick={() => setOffset(offset - 24)}
            >
              Previous
            </button>
            <span className="text-sm">Page {offset / 24 + 1}</span>
            <button
              type="button"
              className={control}
              disabled={query.data?.nextOffset == null || query.isFetching || term !== search}
              onClick={() => setOffset(query.data!.nextOffset!)}
            >
              Next
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
