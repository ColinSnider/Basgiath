import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/basgiath-store";
import { useAuth } from "@/lib/auth-context";
import { ChevronLeft, Settings } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { books, margins, goals } = useStore();
  const { user } = useAuth();

  const finishedBooks = books.filter((b) => b.status === "finished").length;
  const currentYear = new Date().getFullYear();
  const readsThisYear = books.reduce((sum, b) => sum + b.reads.filter((r) => new Date(r.finishedAt).getFullYear() === currentYear).length, 0);

  return (
    <div>
      <div className="px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" /> Home
        </Link>
      </div>

      <header className="px-5 pt-2 pb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary">{user?.displayName ?? "Profile"}</h1>
          <p className="text-sm text-muted-foreground mt-1">@{user?.username}</p>
        </div>
        <Link to="/settings" className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      <section className="px-5 space-y-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Reading stats</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-display text-2xl text-primary">{books.length}</p>
              <p className="text-[11px] text-muted-foreground">total books</p>
            </div>
            <div>
              <p className="font-display text-2xl text-primary">{finishedBooks}</p>
              <p className="text-[11px] text-muted-foreground">finished</p>
            </div>
            <div>
              <p className="font-display text-2xl text-primary">{readsThisYear}</p>
              <p className="text-[11px] text-muted-foreground">this year</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-display text-2xl text-primary">{margins.length}</p>
              <p className="text-[11px] text-muted-foreground">margins</p>
            </div>
            <div>
              <p className="font-display text-2xl text-primary">{goals.length}</p>
              <p className="text-[11px] text-muted-foreground">goals</p>
            </div>
            <div>
              <p className="font-display text-2xl text-primary">{books.filter((b) => b.format === "audiobook").length}</p>
              <p className="text-[11px] text-muted-foreground">audiobooks</p>
            </div>
          </div>
        </div>

        <Link
          to="/settings"
          className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings className="h-4 w-4 text-muted-foreground" /> Settings
          </div>
          <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
        </Link>
      </section>
    </div>
  );
}
