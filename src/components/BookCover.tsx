import { Book } from "@/lib/basgiath-store";
import { BookOpen } from "lucide-react";

export function BookCover({ book, size = "md" }: { book: Pick<Book, "title" | "coverUrl">; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-14 w-10" : size === "lg" ? "h-40 w-28" : "h-20 w-14";
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt={`Cover of ${book.title}`}
        loading="lazy"
        className={`${dims} object-cover rounded-sm shadow-md ring-1 ring-border/60`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-sm flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md ring-1 ring-gold/40`}
    >
      <BookOpen className="h-1/3 w-1/3 opacity-80" />
    </div>
  );
}
