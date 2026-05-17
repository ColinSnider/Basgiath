import { Link } from "@tanstack/react-router";
import { UserCircle2, User, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <header className="px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-primary leading-none">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Profile and settings"
          className="text-primary/80 hover:text-primary transition-colors"
        >
          <UserCircle2 className="h-8 w-8" strokeWidth={1.5} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
            {user && (
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium truncate">{user.displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
              </div>
            )}
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <User className="h-4 w-4 text-muted-foreground" /> Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 text-muted-foreground" /> Settings
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left text-destructive/80 hover:text-destructive border-t border-border mt-1"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
