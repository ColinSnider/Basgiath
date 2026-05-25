import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, lastReadDate, totalReads } from "@/lib/basgiath-store";
import { useState } from "react";
import { Star } from "lucide-react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/library")({
  component: Library,
});


function Library() {
  const { books, addBook } = useStore();
  const [tab, setTab] = useState<"reading" | "finished" | "tbr" | "dnf">("reading");
  const [searching, setSearching] = useState(false);


  const readingBooks = books.filter((b)=>b.status==="reading");
  const tbrBooks = books.filter((b)=>b.status==="wishlist");
  const dnfBooks = books.filter((b)=>b.status==="dnf");
  const pastReadsByYear = Array.from(new Set(books.filter((b)=>b.status!=="dnf").flatMap((b)=>b.reads.map((r)=>new Date(r.finishedAt).getFullYear())))).sort((a,b)=>b-a);

  const allBooks = [...books].sort((a, b) => {
    const la = lastReadDate(a);
    const lb = lastReadDate(b);
    if (la && lb) return lb.localeCompare(la);
    if (la) return -1;
    if (lb) return 1;
    return b.addedAt.localeCompare(a.addedAt);
  });


  function formatDate(value?: string) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  }

  function bookBubbles(b: typeof books[number]) {
    const rating = Number((b.metadata as any)?.rating ?? 0);
    const tags = Array.isArray((b.metadata as any)?.tags) ? ((b.metadata as any).tags as string[]) : [];
    const finishAt = b.reads.length > 0 ? b.reads[b.reads.length - 1]?.finishedAt : undefined;

    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          Started {formatDate(b.addedAt)}
        </span>
        {b.status === "reading" ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            p. {b.currentPage || 0}
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            Finished {formatDate(finishAt)}
          </span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold-foreground inline-flex items-center gap-1">
          <Star className="h-3 w-3" /> {rating || 0}/5
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          {totalReads(b)} reads
        </span>
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

      <div className="px-5">
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
      </div>

      {tab === "reading" ? (
        <section className="px-5 mt-5">
          <ul className="space-y-3">{readingBooks.map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div className="min-w-0 flex-1"><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p>{bookBubbles(b)}</div></Link></li>)}</ul>
        </section>
      ) : tab === "tbr" ? (
        <section className="px-5 mt-5"><ul className="space-y-3">{tbrBooks.map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div className="min-w-0 flex-1"><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p>{bookBubbles(b)}</div></Link></li>)}</ul></section>
      ) : tab === "dnf" ? (
        <section className="px-5 mt-5"><ul className="space-y-3">{dnfBooks.map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div className="min-w-0 flex-1"><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p>{bookBubbles(b)}</div></Link></li>)}</ul></section>
      ) : (
        <section className="px-5 mt-5 space-y-4">
          {pastReadsByYear.map((y)=><div key={y}><h3 className="font-display text-lg mb-2">{y}</h3><ul className="space-y-2">{allBooks.filter((b)=>readsInYear(b,y)>0).map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div className="min-w-0 flex-1"><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p>{bookBubbles(b)}</div></Link></li>)}</ul></div>)}
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
