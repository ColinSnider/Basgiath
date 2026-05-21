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

export type EditionResult = {
  key: string;
  title: string;
  coverUrl?: string;
  publishYear?: number;
  languageCodes?: string[];
  publisher?: string[];
};

const SEARCH_BASE = "https://openlibrary.org/search.json";
const RESULT_LIMIT = 20;
const EDITION_LIMIT = 12;
const SEARCH_FIELDS =
  "key,title,author_name,cover_i,number_of_pages_median,language,first_publish_year,publish_year,edition_count,isbn,publisher";
const ENGLISH_LANGUAGE_CODE = "eng";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";

export function buildSearchUrl(query: string, language?: string): string {
  const params = new URLSearchParams({ q: query.trim(), limit: String(RESULT_LIMIT), fields: SEARCH_FIELDS });
  if (language && language.trim()) params.set("language", language.trim());
  return `${SEARCH_BASE}?${params.toString()}`;
}

function takeStringArray(value: unknown, max = 5): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return values.length ? values.slice(0, max) : undefined;
}

function takeYear(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizeCoverUrl(coverId: unknown): string | undefined {
  return typeof coverId === "number" ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreResult(result: SearchResult, query: string): number {
  const q = normalize(query);
  const title = normalize(result.title);
  const author = normalize(result.author);
  let score = 0;
  if (title === q) score += 120;
  if (title.startsWith(q)) score += 60;
  if (title.includes(q)) score += 30;
  if (author.includes(q)) score += 15;
  for (const token of q.split(" ").filter(Boolean)) {
    if (title.includes(token)) score += 8;
    if (author.includes(token)) score += 3;
  }
  if (result.languageCodes?.includes("eng")) score += 25;
  if (result.coverUrl) score += 10;
  if (result.editionCount) score += Math.min(result.editionCount, 20) / 2;
  return score;
}

function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
  return [...results]
    .map((r) => ({ r, score: scoreResult(r, query) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.r);
}

function pickBestEdition(editions: EditionResult[]): EditionResult | null {
  if (!editions.length) return null;
  const scored = editions
    .map((e) => {
      let score = 0;
      if (e.languageCodes?.includes("eng")) score += 50;
      if (e.coverUrl) score += 20;
      if (e.publishYear) score += 5;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.e ?? null;
}

export function applyEditionToResult(result: SearchResult, edition: EditionResult): SearchResult {
  return {
    ...result,
    title: edition.title || result.title,
    coverUrl: edition.coverUrl || result.coverUrl,
    sourceUrl: `${OPEN_LIBRARY_BASE}${edition.key}`,
    languageCodes: edition.languageCodes ?? result.languageCodes,
    publishYear: edition.publishYear ?? result.publishYear,
    publisher: edition.publisher ?? result.publisher,
  };
}

export function mapDoc(doc: unknown): SearchResult | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Record<string, unknown>;
  const title = typeof d.title === "string" ? d.title.trim() : "";
  if (!title) return null;
  const authorNames = Array.isArray(d.author_name) ? d.author_name : [];
  const author = authorNames.find((a): a is string => typeof a === "string" && a.trim() !== "");
  if (!author) return null;
  const key = typeof d.key === "string" ? d.key : `doc-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}`;
  const pagesRaw = d.number_of_pages_median;
  const totalPages = typeof pagesRaw === "number" && pagesRaw > 0 ? Math.round(pagesRaw) : undefined;
  const publishYears = Array.isArray(d.publish_year)
    ? d.publish_year.filter((y): y is number => typeof y === "number" && Number.isInteger(y) && y > 0)
    : [];
  return {
    key,
    title,
    author: author.trim(),
    coverUrl: normalizeCoverUrl(d.cover_i),
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

function mapEdition(doc: unknown): EditionResult | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Record<string, unknown>;
  const title = typeof d.title === "string" ? d.title.trim() : "";
  const key = typeof d.key === "string" ? d.key : "";
  if (!title || !key) return null;
  const publishYears = Array.isArray(d.publish_year)
    ? d.publish_year.filter((y): y is number => typeof y === "number" && Number.isInteger(y) && y > 0)
    : [];
  const languageCodes = Array.isArray(d.languages)
    ? d.languages
        .map((l) => (typeof l === "string" ? l : typeof (l as { key?: unknown }).key === "string" ? (l as { key: string }).key.split("/").pop() : undefined))
        .filter((code): code is string => !!code && code.trim().length > 0)
        .slice(0, 5)
    : undefined;
  return {
    key,
    title,
    coverUrl: normalizeCoverUrl(Array.isArray(d.covers) ? d.covers[0] : undefined),
    publishYear: publishYears.length ? Math.max(...publishYears) : undefined,
    languageCodes: languageCodes?.length ? languageCodes : undefined,
    publisher: takeStringArray(d.publishers),
  };
}

async function fetchDocs(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search request failed (status ${res.status}). Please try again.`);
  const data = await res.json();
  return Array.isArray(data.docs) ? data.docs : [];
}

export async function fetchWorkEditions(workKey: string): Promise<EditionResult[]> {
  if (!workKey.startsWith("/works/")) return [];
  const params = new URLSearchParams({ limit: String(EDITION_LIMIT) });
  const res = await fetch(`${OPEN_LIBRARY_BASE}${workKey}/editions.json?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const seen = new Set<string>();
  const results: EditionResult[] = [];
  for (const e of entries) {
    const mapped = mapEdition(e);
    if (!mapped || seen.has(mapped.key)) continue;
    seen.add(mapped.key);
    results.push(mapped);
  }
  return results;
}

export async function getBestEditionForWork(workKey: string): Promise<EditionResult | null> {
  const editions = await fetchWorkEditions(workKey);
  return pickBestEdition(editions);
}

export async function searchBooks(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const preferredLanguageDocs = await fetchDocs(buildSearchUrl(q, ENGLISH_LANGUAGE_CODE));
  const mergedDocs = preferredLanguageDocs.length >= RESULT_LIMIT
    ? preferredLanguageDocs
    : [...preferredLanguageDocs, ...await fetchDocs(buildSearchUrl(q))];

  const results: SearchResult[] = [];
  const seenKeys = new Set<string>();
  for (const doc of mergedDocs) {
    const mapped = mapDoc(doc);
    if (!mapped || seenKeys.has(mapped.key)) continue;
    seenKeys.add(mapped.key);
    results.push(mapped);
    if (results.length >= RESULT_LIMIT) break;
  }
  return rankSearchResults(results, q);
}
