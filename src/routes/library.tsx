import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, lastReadDate, totalReads, type Book } from "@/lib/basgiath-store";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/library")({
  component: Library,
});

function BookSpine({ book }: { book: Book }) {
  const [spineColor, setSpineColor] = useState("hsl(29 58% 38%)");
  const authorInitials = book.author
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!book.coverUrl || typeof window === "undefined") return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = book.coverUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = 16;
        canvas.height = 16;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let totalLuma = 0;
        const buckets = new Map<string, { count: number; r: number; g: number; b: number; sat: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
          const prev = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, sat: 0 };
          buckets.set(key, { count: prev.count + 1, r: prev.r + r, g: prev.g + g, b: prev.b + b, sat: prev.sat + sat });
          totalLuma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        const avgLuma = totalLuma / (data.length / 4);
        const ranked = [...buckets.values()].sort((a, b) => {
          const aSat = a.sat / a.count;
          const bSat = b.sat / b.count;
          return bSat * b.count - aSat * a.count;
        });
        const pick = ranked.find((bucket) => bucket.count >= 2) ?? ranked[0];
        if (!pick) return;
        const baseR = Math.round(pick.r / pick.count);
        const baseG = Math.round(pick.g / pick.count);
        const baseB = Math.round(pick.b / pick.count);
        const brighten = avgLuma < 65 ? 1.35 : avgLuma < 95 ? 1.2 : 1;
        const r = Math.min(255, Math.round(baseR * brighten));
        const g = Math.min(255, Math.round(baseG * brighten));
        const b = Math.min(255, Math.round(baseB * brighten));
        setSpineColor(`rgb(${r}, ${g}, ${b})`);
      } catch {
        // Graceful fallback when cover hosts block canvas reads.
      }
    };
  }, [book.coverUrl]);

  const width = Math.max(46, Math.min(110, Math.round((book.totalPages ?? 260) / 8)));

  return (
    <div
      className="h-36 rounded-md border border-border/80 shadow-sm relative overflow-hidden"
      style={{ width, backgroundColor: spineColor }}
    >
      <div className="absolute inset-y-0 left-2 w-px bg-white/35" />
      <div className="absolute inset-y-0 right-2 w-px bg-black/25" />
      <div className="absolute top-2 left-2 right-2 h-1 rounded-full bg-white/35" />
      <div className="absolute inset-0 px-3 py-2 flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/75">{authorInitials}</p>
        <p className="text-sm font-semibold text-white [writing-mode:vertical-rl] [text-orientation:mixed] leading-tight h-full whitespace-normal break-words">
          {book.title}
        </p>
        <p className="text-[10px] text-white/80">{book.totalPages ? `${book.totalPages}p` : ""}</p>
      </div>
    </div>
  );
}

function Library() {
  const { books, addBook } = useStore();
  const [tab, setTab] = useState<"reading" | "finished" | "tbr" | "dnf">("reading");
  const [viewMode, setViewMode] = useState<"list" | "bookshelf">("list");
  const [searching, setSearching] = useState(false);

  const readingBooks = books.filter((b) => b.status === "reading");
  const tbrBooks = books.filter((b) => b.status === "wishlist");
  const dnfBooks = books.filter((b) => b.status === "dnf");
  const pastReadsByYear = Array.from(
    new Set(
      books
        .filter((b) => b.status !== "dnf")
        .flatMap((b) => b.reads.map((r) => new Date(r.finishedAt).getFullYear())),
    ),
  ).sort((a, b) => b - a);

  const allBooks = [...books].sort((a, b) => {
    const la = lastReadDate(a);
    const lb = lastReadDate(b);
    if (la && lb) return lb.localeCompare(la);
    if (la) return -1;
    if (lb) return 1;
    return b.addedAt.localeCompare(a.addedAt);
  });

  const activeBooks =
    tab === "reading" ? readingBooks : tab === "tbr" ? tbrBooks : tab === "dnf" ? dnfBooks : allBooks;

  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  }

  function bookBubbles(b: Book) {
    const rating = Number((b.metadata as any)?.rating ?? 0);
    const tags = Array.isArray((b.metadata as any)?.tags) ? ((b.metadata as any).tags as string[]) : [];
    const finishAt = b.reads.length > 0 ? b.reads[b.reads.length - 1]?.finishedAt : undefined;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Started {formatDate(b.addedAt)}</span>
        {b.status === "reading" ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">p. {b.currentPage || 0}</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Finished {formatDate(finishAt)}</span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold-foreground inline-flex items-center gap-1">
          <Star className="h-3 w-3" /> {rating || 0}/5
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{totalReads(b)} reads</span>
        {tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-border">
            #{tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    <>
      <AppHeader title="Library" subtitle="Your reading history." />

      <div className="px-5 space-y-3">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["reading", "finished", "tbr", "dnf"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "reading" ? "Current Reads" : t === "finished" ? "Past Reads" : t === "tbr" ? "TBR" : "DNF"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["list", "bookshelf"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                viewMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {m === "list" ? "List View" : "Bookshelf"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "bookshelf" ? (
        <section className="px-5 mt-5">
          <div className="bg-card border border-border rounded-lg px-4 py-5 min-h-[260px]">
            <div className="flex flex-wrap gap-2 items-end">
              {activeBooks.map((b) => (
                <Link key={b.id} to="/book/$id" params={{ id: b.id }} aria-label={b.title}>
                  <BookSpine book={b} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : tab === "reading" ? (
        <section className="px-5 mt-5">
          <ul className="space-y-3">
            {readingBooks.map((b) => (
              <li key={b.id}>
                <Link
                  to="/book/$id"
                  params={{ id: b.id }}
                  className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"
                >
                  <BookCover book={b} />
                  <div>
                    <p className="font-medium text-sm">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.author}</p>
                    {bookBubbles(b)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : tab === "tbr" ? (
        <section className="px-5 mt-5">
          <ul className="space-y-3">
            {tbrBooks.map((b) => (
              <li key={b.id}>
                <Link
                  to="/book/$id"
                  params={{ id: b.id }}
                  className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"
                >
                  <BookCover book={b} />
                  <div>
                    <p className="font-medium text-sm">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.author}</p>
                    {bookBubbles(b)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : tab === "dnf" ? (
        <section className="px-5 mt-5">
          <ul className="space-y-3">
            {dnfBooks.map((b) => (
              <li key={b.id}>
                <Link
                  to="/book/$id"
                  params={{ id: b.id }}
                  className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"
                >
                  <BookCover book={b} />
                  <div>
                    <p className="font-medium text-sm">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.author}</p>
                    {bookBubbles(b)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="px-5 mt-5 space-y-4">
          {pastReadsByYear.map((y) => (
            <div key={y}>
              <h3 className="font-display text-lg mb-2">{y}</h3>
              <ul className="space-y-2">
                {allBooks
                  .filter((b) => readsInYear(b, y) > 0)
                  .map((b) => (
                    <li key={b.id}>
                      <Link
                        to="/book/$id"
                        params={{ id: b.id }}
                        className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"
                      >
                        <BookCover book={b} />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{b.title}</p>
                          <p className="text-xs text-muted-foreground">{b.author}</p>
                          {bookBubbles(b)}
                        </div>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {searching && (
        <BookSearch
          onClose={() => setSearching(false)}
          onPick={(r) => {
            addBook({
              title: r.title,
              author: r.author,
              coverUrl: r.coverUrl,
              totalPages: r.totalPages,
              currentPage: 0,
              format: r.format ?? "book",
              durationMinutes: r.durationMinutes,
              status: r.status ?? "reading",
              reads: r.finishedAt ? [{ finishedAt: r.finishedAt }] : [],
              addedAt: r.addedAt,
              extraReads: r.extraReads,
              metadata: {
                source: r.source,
                sourceKey: r.key,
                sourceUrl: r.sourceUrl,
                languageCodes: r.languageCodes,
                firstPublishYear: r.firstPublishYear,
                publishYear: r.publishYear,
                editionCount: r.editionCount,
                isbn: r.isbn,
                publisher: r.publisher,
              },
            });
            setSearching(false);
          }}
        />
      )}
    </>
  );
}
