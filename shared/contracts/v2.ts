import type { JsonValue } from "../json";

export type WorkId = string;
export type EditionId = string;
export type UserBookId = string;

export type WorkSummary = {
  id: WorkId;
  title: string;
  authors: string[];
  coverUrl: string | null;
  seriesLabel: string | null;
};

export type EditionSummary = {
  id: EditionId;
  workId: WorkId;
  format: "book" | "audiobook" | "ebook" | "unknown";
  pageCount: number | null;
  durationSeconds: number | null;
  language: string | null;
  identifiers: { scheme: string; value: string }[];
};

export type UserBookStatus = "want_to_read" | "reading" | "paused" | "read" | "dnf";

export type UserBookSummary = WorkSummary & {
  userBookId: UserBookId;
  status: UserBookStatus;
  isFavorite: boolean;
  personalRatingUnits: number | null;
  selectedEditionId: EditionId | null;
  legacyMetadata?: Record<string, JsonValue>;
};

export type ReadingSession = {
  id: string;
  userBookId: UserBookId;
  state: "active" | "paused" | "completed" | "dnf";
  startedAt: string | null;
  finishedAt: string | null;
  datePrecision: "instant" | "date" | "unknown";
  format: "book" | "audiobook" | "ebook" | "unknown";
};

export type ProgressEntry = {
  id: string;
  readingSessionId: string;
  unit: "page" | "second" | "percent";
  position: number;
  occurredAt: string | null;
  localDate: string | null;
  clientMutationId: string;
};

export type ServiceErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VERSION_CONFLICT"
  | "PROVIDER_UNAVAILABLE"
  | "WRITE_PAUSED";
