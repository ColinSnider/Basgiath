export type SearchResult = {
  key: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages?: number;
};

export async function searchBooks(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  // sort=readinglog (most-read first) + language=eng causes Open Library to
  // assign non-English canonical titles their native language as lang[0],
  // while English works reliably show lang[0]==="eng". This combination lets
  // us filter out translated titles client-side with high reliability.
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q.trim())}&language=eng&sort=readinglog&limit=60&fields=key,title,author_name,cover_i,number_of_pages_median,language`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.docs as any[])
    .filter((d) => {
      if (!d.title || !d.author_name) return false;
      if (!d.language || d.language.length === 0) return true;
      return d.language[0] === "eng";
    })
    .slice(0, 15)
    .map((d) => ({
      key: d.key,
      title: d.title,
      author: d.author_name?.[0] || "Unknown",
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      totalPages: d.number_of_pages_median || undefined,
    }));
}
