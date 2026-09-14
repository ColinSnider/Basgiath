import { z } from "zod";
import type { CatalogProvider } from "./library-service.ts";
import type { WorkSearchResult } from "./open-library-provider.ts";

const volumeId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const volume = z.object({
  id: volumeId,
  volumeInfo: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    authors: z.array(z.string()).optional(),
    pageCount: z.number().int().positive().optional(),
    language: z.string().optional(),
    categories: z.array(z.string()).optional(),
    description: z.string().optional(),
    imageLinks: z.object({ thumbnail: z.string().optional() }).optional(),
  }),
});

export function createGoogleBooksProvider(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): CatalogProvider & { search(query: string): Promise<WorkSearchResult[]> } {
  if (!options.apiKey.trim()) throw new Error("Google Books is not configured.");
  const cache = new Map<string, { expires: number; value: unknown }>();
  const pending = new Map<string, Promise<unknown>>();
  let cooldown = 0;
  async function get(path: string) {
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (pending.has(path)) return pending.get(path)!;
    if (Date.now() < cooldown) throw new Error("Google Books is temporarily unavailable.");
    const request = (async () => {
      const url = new URL(`https://www.googleapis.com/books/v1/${path}`);
      url.searchParams.set("key", options.apiKey);
      try {
        const response = await (options.fetchImpl ?? fetch)(url, {
          signal: AbortSignal.timeout(15000),
          redirect: "error",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          if (response.status === 429 || response.status === 403) cooldown = Date.now() + 30000;
          throw new Error("Google Books request failed.");
        }
        const value: unknown = await response.json();
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(path, { value, expires: Date.now() + 15 * 60 * 1000 });
        return value;
      } catch {
        // Never expose a fetch error containing the API-key URL.
        throw new Error("Google Books is temporarily unavailable.");
      }
    })().finally(() => pending.delete(path));
    pending.set(path, request);
    return request;
  }
  function cover(value?: string) {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (!["books.google.com", "books.googleusercontent.com"].includes(url.hostname)) return null;
      url.protocol = "https:";
      return url.toString();
    } catch {
      return null;
    }
  }
  return {
    async search(query) {
      const q = z.string().trim().min(1).max(200).parse(query);
      const response = z
        .object({ items: z.array(z.unknown()).default([]) })
        .parse(
          await get(
            `volumes?${new URLSearchParams({ q, printType: "books", orderBy: "relevance", maxResults: "20" })}`,
          ),
        );
      const found = new Map<string, WorkSearchResult>();
      for (const raw of response.items.slice(0, 20)) {
        const parsed = volume.safeParse(raw);
        if (!parsed.success) continue;
        const { id, volumeInfo: info } = parsed.data;
        found.set(id, {
          ref: { provider: "googlebooks", externalId: id },
          title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
          authors: info.authors ?? [],
          categories: info.categories ?? [],
          coverUrl: cover(info.imageLinks?.thumbnail),
        });
      }
      return [...found.values()];
    },
    async fetchWork(ref) {
      if (ref.provider !== "googlebooks") throw new Error("Unsupported catalog provider.");
      const id = volumeId.parse(ref.externalId);
      const result = volume.parse(await get(`volumes/${encodeURIComponent(id)}`));
      if (result.id !== id) throw new Error("Google Books identity mismatch.");
      const info = result.volumeInfo;
      return {
        title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
        authors: info.authors ?? [],
        coverUrl: cover(info.imageLinks?.thumbnail),
        edition: {
          externalId: id,
          format: "unknown",
          pageCount: info.pageCount ?? null,
          durationSeconds: null,
          language: info.language ?? null,
        },
        description: info.description?.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<\/(p|div)>/gi,"\n").replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").slice(0,10000),
      };
    },
  };
}
