export type SearchResult = {
  key: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages?: number;
  source: "openlibrary";
  sourceUrl: string;
  languageCodes?: string[];
  firstPublishYear?: number;
  publishYear?: number;
  editionCount?: number;
  isbn?: string[];
  publisher?: string[];
};

const SEARCH_BASE = "https://openlibrary.org/search.json";
const RESULT_LIMIT = 20;
const SEARCH_FIELDS =
  "key,title,author_name,cover_i,number_of_pages_median,language,first_publish_year,publish_year,edition_count,isbn,publisher";
const ENGLISH_LANGUAGE_CODE = "eng";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";

export function buildSearchUrl(query: string, language?: string): string {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(RESULT_LIMIT),
    fields: SEARCH_FIELDS,
  });

  if (language && language.trim()) params.set("language", language.trim());

  return `${SEARCH_BASE}?${params.toString()}`;
}

function takeStringArray(value: unknown, max = 5): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return values.length ? values.slice(0, max) : undefined;
}

function takeYear(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return undefined;
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
      : `doc-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}`;

  const coverId = typeof d.cover_i === "number" ? d.cover_i : null;
  const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;

  const pagesRaw = d.number_of_pages_median;
  const totalPages = typeof pagesRaw === "number" && pagesRaw > 0 ? Math.round(pagesRaw) : undefined;

  const publishYears = Array.isArray(d.publish_year)
    ? d.publish_year.filter((y): y is number => typeof y === "number" && Number.isInteger(y) && y > 0)
    : [];

  return {
    key,
    title,
    author: author.trim(),
    coverUrl,
    totalPages,
    source: "openlibrary",
    sourceUrl: `${OPEN_LIBRARY_BASE}${key}`,
    languageCodes: takeStringArray(d.language),
    firstPublishYear: takeYear(d.first_publish_year),
    publishYear: publishYears.length ? Math.max(...publishYears) : undefined,
    editionCount: takeYear(d.edition_count),
    isbn: takeStringArray(d.isbn, 10),
    publisher: takeStringArray(d.publisher, 5),
  };
}

async function fetchDocs(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search request failed (status ${res.status}). Please try again.`);
  const data = await res.json();
  return Array.isArray(data.docs) ? data.docs : [];
}

export async function searchBooks(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const preferredLanguageDocs = await fetchDocs(buildSearchUrl(q, ENGLISH_LANGUAGE_CODE));
  if (preferredLanguageDocs.length >= RESULT_LIMIT) {
    return preferredLanguageDocs.map(mapDoc).filter((r): r is SearchResult => r !== null);
  }
  const mergedDocs = [...preferredLanguageDocs, ...await fetchDocs(buildSearchUrl(q))];
  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();
  for (const doc of mergedDocs) {
    const mapped = mapDoc(doc);
    if (!mapped || seenKeys.has(mapped.key)) continue;
    seenKeys.add(mapped.key);
    results.push(mapped);
    if (results.length >= RESULT_LIMIT) break;
  }
  return results;
}
