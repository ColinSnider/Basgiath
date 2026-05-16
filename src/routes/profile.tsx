import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/basgiath-store";
import { ChevronLeft, Moon, Sun, Trash2 } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { profile, updateProfile, books, margins, goals } = useStore();

  function clearAll() {
    if (!confirm("Erase all books, margins, and goals? This can't be undone.")) return;
    localStorage.removeItem("basgiath:v1");
    location.reload();
  }

  return (
    <div>
      <div className="px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" /> Home
        </Link>
      </div>

      <header className="px-5 pt-2 pb-6">
        <h1 className="font-display text-3xl text-primary">Profile</h1>
      </header>

      <section className="px-5 space-y-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <label className="text-xs text-muted-foreground">Display name</label>
          <input
            value={profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
            className="w-full mt-1 bg-muted rounded-md px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
          </div>
          <button
            onClick={() => updateProfile({ darkMode: !profile.darkMode })}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              profile.darkMode ? "bg-primary" : "bg-muted"
            }`}
            aria-pressed={profile.darkMode}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow flex items-center justify-center transition-all ${
                profile.darkMode ? "left-[1.375rem]" : "left-0.5"
              }`}
            >
              {profile.darkMode ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
            </span>
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Your reading</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-display text-2xl text-primary">{books.length}</p>
              <p className="text-[11px] text-muted-foreground">books</p>
            </div>
            <div>
              <p className="font-display text-2xl text-primary">{margins.length}</p>
              <p className="text-[11px] text-muted-foreground">margins</p>
            </div>
            <div>
              <p className="font-display text-2xl text-primary">{goals.length}</p>
              <p className="text-[11px] text-muted-foreground">goals</p>
            </div>
          </div>
        </div>

        <button
          onClick={clearAll}
          className="w-full inline-flex items-center justify-center gap-1.5 border border-destructive/30 text-destructive rounded-lg py-2.5 text-sm hover:bg-destructive/5"
        >
          <Trash2 className="h-4 w-4" /> Erase all data
        </button>

        <p className="text-[11px] text-muted-foreground/80 text-center pt-2">
          Basgiath stores everything locally on your device.
        </p>
      </section>
    </div>
  );
}
