import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { BookCover } from "@/components/BookCover";
import { useStore, readsInYear, totalReads } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Plus, Target, Quote, StickyNote } from "lucide-react";
import { useState } from "react";
import { BookSearch } from "@/components/BookSearch";

export const Route = createFileRoute("/")({ component: Home });

function Dashboard() {
  const { books, margins, goals, addBook } = useStore();
  const { user } = useAuth();
  const [searching, setSearching] = useState(false);
  const year = new Date().getFullYear();
  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");
  const tbr = books.filter((b) => b.status === "wishlist");
  const finishedThisYear = books.reduce((sum, b) => sum + readsInYear(b, year), 0);
  const totalAllReads = books.reduce((sum, b) => sum + totalReads(b), 0);

  return <>
    <AppHeader title="Basgiath" subtitle={`Welcome, ${user?.displayName ?? "Reader"}.`} />
    <main className="px-5 pb-6 max-w-7xl mx-auto">
      <section className="border border-border bg-card p-5 rounded-md">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{year} in books</p>
        <p className="font-display text-5xl mt-2">{finishedThisYear}</p>
        <p className="text-sm text-muted-foreground">Finished this year · {totalAllReads} all-time reads</p>
      </section>

      <section className="grid md:grid-cols-3 gap-3 mt-4">
        <Link to="/library" className="border border-border bg-card rounded-md p-4"><p className="text-xs text-muted-foreground">Current Reads</p><p className="font-display text-3xl">{reading.length}</p></Link>
        <Link to="/library" className="border border-border bg-card rounded-md p-4"><p className="text-xs text-muted-foreground">Past Reads</p><p className="font-display text-3xl">{finished.length}</p></Link>
        <Link to="/library" className="border border-border bg-card rounded-md p-4"><p className="text-xs text-muted-foreground">TBR</p><p className="font-display text-3xl">{tbr.length}</p></Link>
      </section>

      <section className="border border-border bg-card p-4 rounded-md mt-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-display text-xl">Reading now</h2><button onClick={() => setSearching(true)} className="text-xs font-medium text-primary inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add</button></div>
        {reading.length === 0 ? <p className="text-sm text-muted-foreground">Nothing on your bookmark yet.</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{reading.map((b) => <Link key={b.id} to="/book/$id" params={{ id: b.id }} className="border border-border rounded-md p-3 flex items-center gap-3"><BookCover book={b} size="sm" /><div><p className="text-sm font-semibold line-clamp-1">{b.title}</p><p className="text-xs text-muted-foreground">{b.author}</p></div></Link>)}</div>}
      </section>

      <section className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="border border-border bg-card p-4 rounded-md"><h2 className="font-display text-xl mb-2 inline-flex gap-1 items-center"><Target className="h-4 w-4 text-primary"/>Goals</h2>{goals.length===0?<p className="text-sm text-muted-foreground">No goals set.</p>:<ul className="space-y-2">{goals.map((g)=><li key={g.id}><Link to="/goals" className="text-sm underline-offset-2 hover:underline capitalize">{g.timeframe}ly {g.metric} target: {g.target}</Link></li>)}</ul>}</div>
        <div className="border border-border bg-card p-4 rounded-md"><h2 className="font-display text-xl mb-2">Recent margins</h2>{margins.length===0?<p className="text-sm text-muted-foreground">No margins yet.</p>:<ul className="space-y-2">{margins.slice(0,4).map((m)=><li key={m.id}><Link to="/margins" className="block border border-border rounded-md p-2"><p className="text-sm line-clamp-2">{m.text}</p><p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">{m.type==="quote"?<Quote className="h-3 w-3"/>:<StickyNote className="h-3 w-3"/>}{m.type}</p></Link></li>)}</ul>}</div>
      </section>
    </main>
    {searching && <BookSearch onClose={() => setSearching(false)} onPick={(r) => { addBook({ title: r.title, author: r.author, coverUrl: r.coverUrl, totalPages: r.totalPages, currentPage: 0, format: r.format ?? "book", durationMinutes: r.durationMinutes, status: r.status ?? "reading", reads: r.finishedAt ? [{ finishedAt: r.finishedAt }] : [], addedAt: r.addedAt, extraReads: r.extraReads }); setSearching(false); }} />}
  </>;
}

function Landing() {
  return <div className="min-h-screen flex items-center justify-center p-6"><div className="max-w-xl text-center"><BookOpen className="h-8 w-8 text-primary mx-auto"/><h1 className="font-display text-5xl mt-3">Basgiath</h1><p className="text-muted-foreground mt-3">Track books, audiobooks, margins, and goals.</p><Link to="/login" className="inline-block mt-6 bg-primary text-primary-foreground px-5 py-3 rounded-md">Sign in</Link></div></div>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Landing />;
  return <Dashboard />;
}
