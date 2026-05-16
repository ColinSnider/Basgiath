import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore, totalReads, lastReadDate } from "@/lib/basgiath-store";
import { BookCover } from "@/components/BookCover";
import { ChevronLeft, Check, Trash2, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/book/$id")({
  component: BookDetail,
});

function BookDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { books, margins, updateBook, removeBook, finishRead } = useStore();
  const book = books.find((b) => b.id === id);
  const [page, setPage] = useState("");
  const [totalPages, setTotalPages] = useState("");

  useEffect(() => {
    if (book) {
      setPage(String(book.currentPage ?? 0));
      setTotalPages(String(book.totalPages ?? ""));
    }
  }, [book]);

  if (!book) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Book not found.</p>
        <Link to="/library" className="text-primary text-sm mt-2 inline-block">
          Back to library
        </Link>
      </div>
    );
  }

  const myMargins = margins.filter((m) => m.bookId === book.id);
  const last = lastReadDate(book);
  const reads = totalReads(book);

  function saveProgress() {
    const cp = Math.max(0, Number(page) || 0);
    const tp = totalPages ? Math.max(0, Number(totalPages)) : undefined;
    updateBook(book!.id, { currentPage: cp, totalPages: tp });
  }

  return (
    <div>
      <div className="px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/library" })}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" /> Back
        </button>
        <button
          onClick={() => {
            if (confirm("Remove this book and all its margins?")) {
              removeBook(book.id);
              navigate({ to: "/library" });
            }
          }}
          className="text-muted-foreground/70 hover:text-destructive p-1"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 flex gap-4 items-start">
        <BookCover book={book} size="lg" />
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="font-display text-2xl leading-tight">{book.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
          <p className="text-[11px] text-muted-foreground/80 mt-3">
            {reads === 0
              ? "Not yet finished"
              : `Read ${reads} time${reads > 1 ? "s" : ""}${last ? ` · last ${new Date(last).toLocaleDateString()}` : ""}`}
          </p>
        </div>
      </div>

      <section className="px-5 mt-6">
        <h2 className="font-display text-lg mb-2">Bookmark</h2>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Current page</label>
              <input
                value={page}
                onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Total pages</label>
              <input
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
              />
            </div>
            <button
              onClick={saveProgress}
              className="bg-primary text-primary-foreground rounded-md py-2 px-3 text-sm font-medium"
            >
              Save
            </button>
          </div>
          {book.totalPages ? (
            <div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-gold"
                  style={{
                    width: `${Math.min(100, Math.round(((book.currentPage ?? 0) / book.totalPages) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {Math.min(100, Math.round(((book.currentPage ?? 0) / book.totalPages) * 100))}% complete
              </p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              onClick={() => finishRead(book.id)}
              className="flex-1 inline-flex items-center justify-center gap-1 bg-gold text-gold-foreground rounded-md py-2 text-sm font-medium hover:opacity-90"
            >
              <Check className="h-4 w-4" /> Mark finished
            </button>
            {book.status === "finished" && (
              <button
                onClick={() => updateBook(book.id, { status: "reading", currentPage: 0 })}
                className="inline-flex items-center justify-center gap-1 border border-border rounded-md py-2 px-3 text-sm"
              >
                <RotateCcw className="h-4 w-4" /> Re-read
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg">Margins</h2>
          <Link to="/margins" className="text-xs text-primary font-medium">
            Add →
          </Link>
        </div>
        {myMargins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet for this book.</p>
        ) : (
          <ul className="space-y-2">
            {myMargins.map((m) => (
              <li key={m.id} className="bg-card border border-border rounded-lg p-3">
                <p className={`text-sm ${m.type === "quote" ? "font-display italic" : ""}`}>{m.text}</p>
                {m.page && <p className="text-[11px] text-muted-foreground mt-1">p. {m.page}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {book.reads.length > 0 && (
        <section className="px-5 mt-6 mb-4">
          <h2 className="font-display text-lg mb-2">Reading history</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            {book.reads
              .slice()
              .reverse()
              .map((r, i) => (
                <li key={i} className="flex justify-between bg-card border border-border rounded-md px-3 py-2">
                  <span>Read #{book.reads.length - i}</span>
                  <span>{new Date(r.finishedAt).toLocaleDateString()}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
