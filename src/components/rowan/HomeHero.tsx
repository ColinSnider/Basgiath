import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Bookmark, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function HomeHero() {
  const { user } = useAuth();
  return (
    <section className="reader-hero" aria-labelledby="hero-title">
      <div className="reader-hero-copy">
        <p className="reader-hero-eyebrow">
          <Sparkles size={15} aria-hidden="true" />
          {user && !user.isGuest
            ? `Welcome back, ${user.displayName || user.username}`
            : "A home for your reading life"}
        </p>
        <h2 id="hero-title">
          One more page.
          <br />
          <em>A whole new world.</em>
        </h2>
        <p>
          Your books, your little discoveries, your next chapter. Pick up wherever the story takes
          you.
        </p>
        <div className="reader-hero-actions">
          <Link to="/library">
            <BookOpen size={18} aria-hidden="true" />
            Open my library
          </Link>
          <Link to="/search">
            Find your next read
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="reader-hero-art" aria-hidden="true">
        <div className="reader-hero-book reader-hero-book-back" />
        <div className="reader-hero-book reader-hero-book-front">
          <Bookmark size={24} strokeWidth={1} />
          <BookOpen size={64} strokeWidth={0.8} />
          <span>
            Between
            <br />
            the pages
          </span>
          <small>YOUR NEXT CHAPTER</small>
        </div>
      </div>
    </section>
  );
}
