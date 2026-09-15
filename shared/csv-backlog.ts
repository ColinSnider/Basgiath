import { backlogRow } from "./backlog.ts";
export const csvFields = [
  "title",
  "author",
  "format",
  "total",
  "reads",
  "startedAt",
  "finishedAt",
] as const;
export type CsvField = (typeof csvFields)[number];
export function parseCsv(text: string): string[][] {
  if (text.length > 2_000_000) throw new Error("CSV must be under 2 MB.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (ch === '"' && !field && !closed) {
      quoted = true;
      continue;
    }
    if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (ch !== ",") {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (ch === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed || ch === '"') throw new Error("Invalid CSV quoting.");
      field += ch;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > 501)
    throw new Error("Choose a header row and 1–500 book rows.");
  if (rows.some((row) => row.length !== rows[0].length))
    throw new Error("CSV rows have different numbers of columns.");
  return rows;
}
export function csvDate(value: string, style: "iso" | "mdy" | "dmy") {
  if (!value.trim()) return null;
  let year: number, month: number, day: number;
  if (style === "iso") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) throw new Error("Dates must use YYYY-MM-DD.");
    [, year, month, day] = match.map(Number);
  } else {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    if (!match) throw new Error("Dates must use slash-separated dates with a four-digit year.");
    year = Number(match[3]);
    month = Number(match[style === "mdy" ? 1 : 2]);
    day = Number(match[style === "mdy" ? 2 : 1]);
  }
  const date = new Date(year, month - 1, day, 12);
  if (
    year < 1000 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    throw new Error("Invalid date.");
  return date.toISOString();
}
export function mapCsvRow(
  row: string[],
  mapping: Partial<Record<CsvField, number>>,
  style: "iso" | "mdy" | "dmy",
) {
  const get = (key: CsvField) => (mapping[key] === undefined ? "" : row[mapping[key]!].trim());
  const format = get("format").toLowerCase() || "book";
  const startedAt = csvDate(get("startedAt"), style),
    finishedAt = csvDate(get("finishedAt"), style);
  return backlogRow.parse({
    title: get("title"),
    author: get("author"),
    format,
    total: get("total") ? Number(get("total")) : null,
    reads: get("reads") ? Number(get("reads")) : startedAt || finishedAt ? 1 : 0,
    startedAt,
    finishedAt,
  });
}
