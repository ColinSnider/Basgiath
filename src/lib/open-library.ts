export type SearchResult = {
  key: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages?: number;
};

const SEARCH_BASE = "https://openlibrary.org/search.json";
const RESULT_LIMIT = 20;
const SEARCH_FIELDS = "key,title,author_name,cover_i,number_of_pages_median";

export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(RESULT_LIMIT),
    fields: SEARCH_FIELDS,
  });
  return `${SEARCH_BASE}?${params.toString()}`;
}

export function mapDoc(doc: unknown): SearchResult | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Record<string, unknown>;

  const title = typeof d.title === "string" ? d.title.trim() : "";
  if (!title) return null;

  const authorNames = Array.isArray(d.author_name) ? d.author_name : [];
  const author = authorNames.find((a): a is string => typeof a === "string" && a.trim() !== "");
  if (!author) return null;

  const key =
    typeof d.key === "string"
      ? d.key
      : `doc-${title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 50)}`;
  const coverId = typeof d.cover_i === "number" ? d.cover_i : null;
  const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;

  const pagesRaw = d.number_of_pages_median;
  const totalPages = typeof pagesRaw === "number" && pagesRaw > 0 ? Math.round(pagesRaw) : undefined;

  return { key, title, author: author.trim(), coverUrl, totalPages };
}

export async function searchBooks(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const url = buildSearchUrl(q);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search request failed (status ${res.status}). Please try again.`);
  const data = await res.json();
  if (!Array.isArray(data.docs)) return [];
  return data.docs.map(mapDoc).filter((r): r is SearchResult => r !== null);
}
