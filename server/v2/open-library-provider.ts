import { z } from "zod";
import type { CatalogProvider } from "./library-service.ts";

const workKey = z.string().regex(/^\/works\/OL\d+W$/);
const docSchema = z.object({
  key: workKey,
  title: z.string().min(1),
  author_name: z.array(z.string()).optional(),
  cover_i: z.number().int().positive().optional(),
});
const searchSchema = z.object({ docs: z.array(z.unknown()) });
const editionSchema = z.object({
  key: z.string().regex(/^\/books\/OL\d+M$/),
  number_of_pages: z.number().int().positive().optional(),
  languages: z.array(z.object({ key: z.string() })).optional(),
});
export type WorkSearchResult = {
  ref: { provider: "openlibrary"; externalId: string };
  title: string;
  authors: string[];
  coverUrl: string | null;
};

/** Create once per server process; keeps requests bounded and caches public metadata only. */
export function createOpenLibraryProvider(options: {
  userAgent: string;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  ttlMs?: number;
}): CatalogProvider & { search(query: string): Promise<WorkSearchResult[]> } {
  if (!options.userAgent.trim()) throw new Error("Open Library requires an application identity.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const intervalMs = Math.max(0, options.intervalMs ?? 1100);
  const ttl = options.ttlMs ?? 15 * 60 * 1000;
  const cache = new Map<string, { expires: number; value: unknown }>();
  const pending = new Map<string, Promise<unknown>>();
  const selectedWorks = new Map<string, { expires: number; value: WorkSearchResult }>();
  let queue: Promise<unknown> = Promise.resolve();
  let nextRequestAt = 0;

  function get(path: string): Promise<unknown> {
    const hit = cache.get(path);
    if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
    const existing = pending.get(path);
    if (existing) return existing;
    const request = queue
      .catch(() => {})
      .then(async () => {
        const wait = Math.max(0, nextRequestAt - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        nextRequestAt = Date.now() + intervalMs;
        const response = await fetchImpl(`https://openlibrary.org${path}`, {
          headers: { "User-Agent": options.userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
          redirect: "error",
        });
        if (!response.ok) {
          // No automatic retry storm; subsequent requests respect a short rate-limit cooldown.
          if (response.status === 429) nextRequestAt = Date.now() + 30_000;
          throw new Error(`Open Library request failed (${response.status}).`);
        }
        const value: unknown = await response.json();
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(path, { value, expires: Date.now() + ttl });
        return value;
      })
      .finally(() => {
        pending.delete(path);
      });
    pending.set(path, request);
    queue = request;
    return request;
  }

  function mapDoc(raw: unknown): WorkSearchResult | null {
    const parsed = docSchema.safeParse(raw);
    if (!parsed.success) return null;
    const doc = parsed.data;
    return {
      ref: { provider: "openlibrary", externalId: doc.key },
      title: doc.title,
      authors: doc.author_name ?? [],
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    };
  }
  const fields = "key,title,author_name,cover_i";
  return {
    async search(query) {
      const trimmed = query.trim();
      if (!trimmed) return [];
      if (trimmed.length > 300) throw new Error("Search query is too long.");
      const params = new URLSearchParams({ q: trimmed, fields, limit: "20" });
      const response = searchSchema.parse(await get(`/search.json?${params}`));
      const found = new Map<string, WorkSearchResult>();
      for (const raw of response.docs.slice(0, 20)) {
        const result = mapDoc(raw);
        if (result && !found.has(result.ref.externalId)) {
          found.set(result.ref.externalId, result);
          if (selectedWorks.size >= 100) selectedWorks.delete(selectedWorks.keys().next().value!);
          selectedWorks.set(result.ref.externalId, { expires: Date.now() + ttl, value: result });
        }
      }
      return [...found.values()];
    },
    async fetchWork(ref) {
      if (ref.provider !== "openlibrary") throw new Error("Unsupported catalog provider.");
      const key = workKey.parse(ref.externalId);
      const params = new URLSearchParams({ q: `key:${key}`, fields, limit: "1" });
      const cached = selectedWorks.get(key);
      const result =
        cached && cached.expires > Date.now()
          ? cached.value
          : searchSchema
              .parse(await get(`/search.json?${params}`))
              .docs.map(mapDoc)
              .find((doc) => doc?.ref.externalId === key);
      if (!result) throw new Error("Work not found in Open Library.");
      let edition: Awaited<ReturnType<CatalogProvider["fetchWork"]>>["edition"] = null;
      try {
        const entries = z
          .object({ entries: z.array(z.unknown()) })
          .parse(await get(`${key}/editions.json?limit=12`));
        for (const raw of entries.entries.slice(0, 12)) {
          const parsed = editionSchema.safeParse(raw);
          if (!parsed.success) continue;
          const value = parsed.data;
          edition = {
            externalId: value.key,
            format: "unknown",
            pageCount: value.number_of_pages ?? null,
            durationSeconds: null,
            language: value.languages?.[0]?.key.split("/").pop() ?? null,
          };
          break;
        }
      } catch {
        // Work selection succeeds when optional edition enrichment is unavailable.
      }
      return { title: result.title, authors: result.authors, coverUrl: result.coverUrl, edition };
    },
  };
}
