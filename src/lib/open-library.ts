export type SearchResult = {
  key: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages?: number;
};

export async function searchBooks(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15&fields=key,title,author_name,cover_i,number_of_pages_median`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data.docs as any[]).map((d) => ({
    key: d.key,
    title: d.title,
    author: (d.author_name && d.author_name[0]) || "Unknown",
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    totalPages: d.number_of_pages_median,
  }));
}
