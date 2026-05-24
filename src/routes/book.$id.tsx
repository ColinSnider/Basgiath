import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore, totalReads, lastReadDate } from "@/lib/basgiath-store";
import { BookCover } from "@/components/BookCover";
import { ChevronLeft, Check, Trash2, RotateCcw, CalendarDays, X, Headphones, Save, Pencil, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/book/$id")({ component: BookDetail });

function BookDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { books, margins, updateBook, removeBook, finishRead } = useStore();
  const book = books.find((b) => b.id === id);

  const [page, setPage] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [minutes, setMinutes] = useState("");
  const [totalMins, setTotalMins] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"reading"|"finished"|"wishlist">("reading");
  const [editingDetails, setEditingDetails] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [finishDate, setFinishDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author);
      setCoverUrl(book.coverUrl ?? "");
      setStatus(book.status);
      const existingTags = Array.isArray((book.metadata as any)?.tags) ? ((book.metadata as any).tags as string[]) : [];
      setTags(existingTags.join(", "));
      if (book.format === "audiobook") {
        setMinutes(String(book.currentMinute ?? 0));
        setTotalMins(String(book.durationMinutes ?? ""));
      } else {
        setPage(String(book.currentPage ?? 0));
        setTotalPages(String(book.totalPages ?? ""));
      }
    }
  }, [book]);

  if (!book) return <div className="p-6 text-center"><p className="text-sm text-muted-foreground">Book not found.</p></div>;

  const isAudio = book.format === "audiobook";
  const myMargins = margins.filter((m) => m.bookId === book.id);
  const last = lastReadDate(book);
  const reads = totalReads(book);

  function saveProgress() {
    if (isAudio) updateBook(book.id, { currentMinute: Math.max(0, Number(minutes) || 0), durationMinutes: totalMins ? Math.max(0, Number(totalMins)) : undefined });
    else updateBook(book.id, { currentPage: Math.max(0, Number(page) || 0), totalPages: totalPages ? Math.max(0, Number(totalPages)) : undefined });
  }

  function saveDetails() {
    const nextTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
    updateBook(book.id, { title: title.trim() || book.title, author: author.trim() || book.author, coverUrl: coverUrl.trim() || null, status, metadata: { ...(book.metadata ?? {}), tags: nextTags } });
    setEditingDetails(false);
  }

  function confirmFinish() {
    const when = finishDate ?? new Date();
    when.setHours(12, 0, 0, 0);
    finishRead(book.id, when.toISOString());
    setShowDatePicker(false);
  }

  const progressPct = isAudio ? (book.durationMinutes ? Math.min(100, Math.round(((book.currentMinute ?? 0) / book.durationMinutes) * 100)) : 0) : (book.totalPages ? Math.min(100, Math.round(((book.currentPage ?? 0) / book.totalPages) * 100)) : 0);

  return <div className="max-w-5xl mx-auto px-3 md:px-6 lg:px-10 pb-6">
    {showDatePicker && <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"><div className="w-full max-w-md bg-card border border-border rounded-md p-5 shadow-xl space-y-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg">When did you finish?</h2><button onClick={() => setShowDatePicker(false)}><X className="h-5 w-5" /></button></div><Calendar mode="single" selected={finishDate} onSelect={setFinishDate} disabled={(d) => d > new Date()} /><div className="flex gap-2"><button onClick={() => setShowDatePicker(false)} className="flex-1 text-sm py-2.5 rounded-md border border-border">Cancel</button><button onClick={confirmFinish} className="flex-1 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium flex items-center justify-center gap-1"><Check className="h-4 w-4" /> Confirm</button></div></div></div>}

    <div className="py-3 flex items-center justify-between"><button onClick={() => navigate({ to: "/library" })} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-5 w-5" /> Back</button><button onClick={() => { if (confirm("Remove this book and all its margins?")) { removeBook(book.id); navigate({ to: "/library" }); } }} className="text-muted-foreground/70 hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button></div>

    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 md:p-6">
      <div className="grid md:grid-cols-[240px_1fr] gap-6 items-start">
        <div className="flex justify-center md:justify-start">
          <BookCover book={book} size="lg" />
        </div>
        <div className="text-center md:text-left">
          <h1 className="font-display text-3xl leading-tight">{book.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{book.author}</p>
          {isAudio && <span className="inline-flex items-center gap-1 mt-2 text-[11px] bg-primary/10 text-primary rounded px-2 py-0.5"><Headphones className="h-3 w-3" /> Audiobook</span>}
          <p className="text-[11px] text-muted-foreground/80 mt-2">{reads === 0 ? "Not yet finished" : `Read ${reads} time${reads > 1 ? "s" : ""}${last ? ` · last ${new Date(last).toLocaleDateString()}` : ""}`}</p>
        </div>
      </div>
    </div>

    <section className="mt-6 bg-card border border-border rounded-md p-4 space-y-3 relative overflow-hidden">
      <Sparkles className="absolute -right-2 -top-2 h-10 w-10 text-primary/20" />
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">Book details</h2>
        {!editingDetails ? (
          <button onClick={() => setEditingDetails(true)} className="inline-flex items-center gap-1 border border-border rounded-md px-3 py-1.5 text-xs hover:bg-muted/40">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        ) : (
          <button onClick={() => setEditingDetails(false)} className="inline-flex items-center gap-1 border border-border rounded-md px-3 py-1.5 text-xs hover:bg-muted/40">
            Cancel
          </button>
        )}
      </div>
      {!editingDetails ? (
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <p><span className="text-muted-foreground">Title:</span> {book.title}</p>
          <p><span className="text-muted-foreground">Author:</span> {book.author}</p>
          <p className="md:col-span-2"><span className="text-muted-foreground">Cover:</span> {book.coverUrl ?? "Default cover"}</p>
          <p><span className="text-muted-foreground">Status:</span> {book.status === "wishlist" ? "TBR" : book.status}</p>
          <p><span className="text-muted-foreground">Tags:</span> {(book.metadata as any)?.tags?.join?.(", ") || "None"}</p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="bg-muted rounded-md px-3 py-2 text-sm" />
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" className="bg-muted rounded-md px-3 py-2 text-sm" />
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="Cover image URL" className="bg-muted rounded-md px-3 py-2 text-sm md:col-span-2" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (Genre, Fantasy, etc.)" className="bg-muted rounded-md px-3 py-2 text-sm" />
            <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="bg-muted rounded-md px-3 py-2 text-sm"><option value="reading">Current Reads</option><option value="finished">Past Reads</option><option value="wishlist">TBR</option></select>
          </div>
          <button onClick={saveDetails} className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm"><Save className="h-4 w-4" /> Save details</button>
        </>
      )}
    </section>

    <section className="mt-6 bg-card border border-border rounded-md p-4 space-y-3">
      <h2 className="font-display text-lg">{isAudio ? "Progress" : "Bookmark"}</h2>
      {isAudio ? <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 items-end"><div><label className="text-xs">Current (hours)</label><input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} className="w-full bg-muted rounded-md px-3 py-2 text-sm"/></div><div><label className="text-xs">Total (hours)</label><input value={totalMins} onChange={(e) => setTotalMins(e.target.value.replace(/\D/g, ""))} className="w-full bg-muted rounded-md px-3 py-2 text-sm"/></div><button onClick={saveProgress} className="bg-primary text-primary-foreground rounded-md py-2 px-3 text-sm font-medium">Save</button></div> : <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 items-end"><div><label className="text-xs">Current page</label><input value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} className="w-full bg-muted rounded-md px-3 py-2 text-sm"/></div><div><label className="text-xs">Total pages</label><input value={totalPages} onChange={(e) => setTotalPages(e.target.value.replace(/\D/g, ""))} className="w-full bg-muted rounded-md px-3 py-2 text-sm"/></div><button onClick={saveProgress} className="bg-primary text-primary-foreground rounded-md py-2 px-3 text-sm font-medium">Save</button></div>}
      {progressPct > 0 && <div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-gold" style={{ width: `${progressPct}%` }} /></div><p className="text-[11px] text-muted-foreground mt-1.5">{progressPct}% complete</p></div>}
      <div className="flex gap-2"><Popover><PopoverTrigger asChild><button className="flex-1 inline-flex items-center justify-center gap-1 bg-gold text-gold-foreground rounded-md py-2 text-sm font-medium"><CalendarDays className="h-4 w-4" /> Pick finish date</button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={finishDate} onSelect={setFinishDate} disabled={(d) => d > new Date()} /></PopoverContent></Popover><button onClick={() => setShowDatePicker(true)} className="flex-1 inline-flex items-center justify-center gap-1 border border-border rounded-md py-2 text-sm"><Check className="h-4 w-4" /> Mark finished</button></div>
      {book.status === "finished" && <button onClick={() => updateBook(book.id, { status: "reading", currentPage: 0 })} className="inline-flex items-center justify-center gap-1 border border-border rounded-md py-2 px-3 text-sm"><RotateCcw className="h-4 w-4" /> Re-read</button>}
    </section>

    <section className="mt-6 mb-6"><h2 className="font-display text-lg mb-2">Margins</h2>{myMargins.length===0?<p className="text-sm text-muted-foreground">No notes yet for this book.</p>:<ul className="space-y-2">{myMargins.map((m)=><li key={m.id} className="bg-card border border-border rounded-md p-3"><Link to="/margins" className="block"><p className={`text-sm ${m.type === "quote" ? "font-display italic" : ""}`}>{m.text}</p>{m.page && <p className="text-[11px] text-muted-foreground mt-1">p. {m.page}</p>}</Link></li>)}</ul>}</section>
  </div>;
}
