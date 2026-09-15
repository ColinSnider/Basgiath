import type { WorkSearchResult } from "./open-library-provider.ts";

// Conservative, explainable presentation filtering, never catalog identity merging.
const extras = [
  /\b(?:colou?ring|activity|sticker|poster|puzzle|trivia)\s+(?:books?|annuals?)\b/i,
  /\b(?:study|cinematic|film|movie|unofficial|unauthori[sz]ed)\s+guides?\b/i,
  /\b(?:box(?:ed)? sets?|omnibus|boxed collections?|fan\s*fiction|fanfic|workbooks?)\b/i,
  /\bseries\)?\s+\d+\s*[-–]\s*\d+\b/i,
];
export function qualitySearch(results: WorkSearchResult[], query: string, includeExtras = false) {
  const requestedExtra = extras.some((pattern) => pattern.test(query));
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return results
    .map((book, index) => {
      const supplemental =
        extras.some((pattern) => pattern.test(book.title)) ||
        (book.categories ?? []).some((category) =>
          /\b(?:fan fiction|study aids|games & activities|coloring books|film adaptations)\b/i.test(
            category,
          ),
        );
      const title = book.title.toLocaleLowerCase();
      const relevance = words.filter((word) => title.includes(word)).length;
      return { book, index, supplemental, relevance };
    })
    .filter((item) => includeExtras || requestedExtra || !item.supplemental)
    .sort(
      (a, b) =>
        Number(a.supplemental) - Number(b.supplemental) ||
        b.relevance - a.relevance ||
        a.index - b.index,
    )
    .map(({ book }) => book);
}
