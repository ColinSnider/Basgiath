import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, lastReadDate } from "@/lib/basgiath-store";
import { useState } from "react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/library")({
  component: Library,
});


function Library() {
  const { books, addBook } = useStore();
  const [tab, setTab] = useState<"reading" | "finished" | "tbr">("reading");
  const [searching, setSearching] = useState(false);


  const readingBooks = books.filter((b)=>b.status==="reading");
  const tbrBooks = books.filter((b)=>b.status==="wishlist");
  const pastReadsByYear = Array.from(new Set(books.flatMap((b)=>b.reads.map((r)=>new Date(r.finishedAt).getFullYear())))).sort((a,b)=>b-a);

  const allBooks = [...books].sort((a, b) => {
    const la = lastReadDate(a);
    const lb = lastReadDate(b);
    if (la && lb) return lb.localeCompare(la);
    if (la) return -1;
    if (lb) return 1;
    return b.addedAt.localeCompare(a.addedAt);
  });

  return (
    <>
      <AppHeader title="Library" subtitle="Your reading history." />

      <div className="px-5">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(["reading", "finished", "tbr"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "reading" ? "Current Reads" : t === "finished" ? "Past Reads" : "TBR"}
            </button>
          ))}
        </div>
      </div>

      {tab === "reading" ? (
        <section className="px-5 mt-5">
          <ul className="space-y-3">{readingBooks.map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p></div></Link></li>)}</ul>
        </section>
      ) : tab === "tbr" ? (
        <section className="px-5 mt-5"><ul className="space-y-3">{tbrBooks.map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p></div></Link></li>)}</ul></section>
      ) : (
        <section className="px-5 mt-5 space-y-4">
          {pastReadsByYear.map((y)=><div key={y}><h3 className="font-display text-lg mb-2">{y}</h3><ul className="space-y-2">{allBooks.filter((b)=>readsInYear(b,y)>0).map((b)=><li key={b.id}><Link to="/book/$id" params={{id:b.id}} className="flex gap-3 items-center bg-card rounded-lg p-3 border border-border"><BookCover book={b}/><div className="flex-1"><p className="font-medium text-sm">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p></div></Link></li>)}</ul></div>)}
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
