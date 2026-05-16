import { Link } from "@tanstack/react-router";
import { UserCircle2 } from "lucide-react";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-primary leading-none">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <Link
        to="/profile"
        aria-label="Profile and settings"
        className="text-primary/80 hover:text-primary transition-colors"
      >
        <UserCircle2 className="h-8 w-8" strokeWidth={1.5} />
      </Link>
    </header>
  );
}
