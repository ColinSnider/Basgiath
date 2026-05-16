import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useStore } from "@/lib/basgiath-store";
import { useMemo, useState } from "react";
import { Quote, StickyNote, Trash2 } from "lucide-react";

export const Route = createFileRoute("/margins")({
  component: Margins,
});

function Margins() {
  const { books, margins, addMargin, removeMargin } = useStore();
  const [bookId, setBookId] = useState<string>("");
  const [type, setType] = useState<"note" | "quote">("quote");
  const [text, setText] = useState("");
  const [page, setPage] = useState("");

  const lookup = useMemo(() => Object.fromEntries(books.map((b) => [b.id, b])), [books]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !bookId) return;
    addMargin({
      bookId,
      type,
      text: text.trim(),
      page: page ? Number(page) : undefined,
    });
    setText("");
    setPage("");
  }

  return (
    <>
      <AppHeader title="Margins" subtitle="Notes, quotes, and reflections." />

      <section className="px-5">
        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Add a book first to start writing in the margins.
          </p>
        ) : (
          <form onSubmit={submit} className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <select
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                className="flex-1 bg-muted rounded-md px-2 py-2 text-sm outline-none"
              >
                <option value="">Choose a book…</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>
              <div className="flex bg-muted rounded-md p-0.5">
                {(["quote", "note"] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-2.5 py-1 text-xs rounded-sm font-medium ${
                      type === t ? "bg-card shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {t === "quote" ? "Quote" : "Note"}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === "quote" ? "“A passage to remember…”" : "A thought, a reaction…"}
              rows={3}
              className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none resize-none"
            />
            <div className="flex gap-2">
              <input
                value={page}
                onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
                placeholder="Page"
                inputMode="numeric"
                className="w-20 bg-muted rounded-md px-2 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="px-5 mt-6">
        <h2 className="font-display text-lg mb-3">Entries</h2>
        {margins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
        ) : (
          <ul className="space-y-3">
            {margins.map((m) => {
              const b = lookup[m.bookId];
              return (
                <li key={m.id} className="bg-card border border-border rounded-lg p-3.5 relative">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold font-semibold">
                    {m.type === "quote" ? <Quote className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />}
                    <span>{m.type}</span>
                  </div>
                  <p className={`mt-1.5 text-sm ${m.type === "quote" ? "font-display italic text-base leading-relaxed" : ""}`}>
                    {m.text}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {b ? (
                        <Link to="/book/$id" params={{ id: b.id }} className="hover:text-foreground">
                          {b.title}
                        </Link>
                      ) : "—"}
                      {m.page ? ` · p. ${m.page}` : ""}
                    </span>
                    <button
                      onClick={() => removeMargin(m.id)}
                      className="text-muted-foreground/70 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
