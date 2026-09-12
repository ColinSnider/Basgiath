import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Library, CheckCheck } from "lucide-react";
import { ReaderPage, useReader } from "../components/reader";
import { useAuth } from "@/lib/auth-context";
import { rowanHome } from "@/lib/rowan-fns";
import { ProfileSettings } from "@/components/rowan/ProfileSettings";
import { BookCover } from "@/components/rowan/BookCover";

export const Route = createFileRoute("/profile")({
  head: () => ({meta: [{title: "Profile — Rowan"}]}),
  component: () => <ReaderPage><ProfilePage/></ReaderPage>,
});
function ProfilePage() {
  const { user } = useAuth();
  const { sessionId, openBook } = useReader();
  const home = useQuery({queryKey: ["rowan", sessionId, "home"], queryFn: () => rowanHome({data: {sessionId}})});
  const name = user?.displayName || user?.username || "Reader";
  return <div className="reader-profile">
    <section className="reader-profile-intro">
      <div className="reader-profile-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase()}</div>
      <div><p className="reader-caption">Your reading life</p><h2>{name}</h2><p>@{user?.username}</p><small>Your private space for the books and moments you keep.</small></div>
    </section>
    {home.isPending && <p role="status">Gathering your reading story…</p>}
    {home.isError && <p role="alert">Your reading summary could not load. <button onClick={() => void home.refetch()}>Try again</button></p>}
    {home.data && <>
      <div className="reader-profile-stats">
        {[{label: "Books in your library", value: home.data.metrics.libraryCount, icon: Library}, {label: "Completed reads", value: home.data.metrics.lifetimeReads, icon: CheckCheck}, {label: "Reading now", value: home.data.metrics.currentReads, icon: BookOpen}].map(({label,value,icon: Icon}) => <div key={label}><Icon size={20}/><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <section className="reader-card"><header className="reader-card-heading"><h2>Your latest chapter</h2><Link to="/calendar" className="reader-text-link">Reading history</Link></header><div className="reader-card-body">
        {home.data.last ? <button className="reader-book-row" onClick={() => openBook(home.data!.last!.book)}><BookCover title={home.data.last.book.title} authors={home.data.last.book.authors} src={home.data.last.book.coverUrl} className="rowan-cover-small"/><span className="reader-book-copy"><span className="reader-book-title">{home.data.last.book.title}</span><span className="reader-muted">{home.data.last.book.authors.join(", ")}</span></span></button> : <p>Your next finished book will have a place here.</p>}
      </div></section>
    </>}
    <ProfileSettings sessionId={sessionId}/>
    <Link to="/account" className="reader-text-link">Appearance, backups, and account settings</Link>
  </div>;
}
