import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import * as dataFns from "./data-fns";

export type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  format: "book" | "audiobook";
  totalPages?: number | null;
  currentPage?: number | null;
  durationMinutes?: number | null;
  currentMinute?: number | null;
  reads: { finishedAt: string }[];
  status: "reading" | "finished" | "wishlist";
  addedAt: string;
};

export type MarginEntry = {
  id: string;
  bookId: string;
  type: "note" | "quote";
  text: string;
  page?: number | null;
  createdAt: string;
};

export type Goal = {
  id: string;
  metric: "books" | "pages" | "minutes";
  target: number;
  timeframe: "week" | "month" | "year";
  createdAt: string;
};

export type Settings = {
  darkMode: boolean;
  accentColor: string;
  compactMode: boolean;
  fontScale: "sm" | "md" | "lg";
};

type StoreState = {
  books: Book[];
  margins: MarginEntry[];
  goals: Goal[];
  settings: Settings;
  dataLoading: boolean;
};

type StoreActions = {
  addBook: (b: Omit<Book, "id" | "reads" | "addedAt" | "status"> & Partial<Pick<Book, "status">>) => Promise<void>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  finishRead: (id: string, finishedAt?: string) => Promise<void>;
  addMargin: (m: Omit<MarginEntry, "id" | "createdAt">) => Promise<void>;
  removeMargin: (id: string) => Promise<void>;
  addGoal: (g: Omit<Goal, "id" | "createdAt">) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  clearAll: () => Promise<void>;
  reload: () => Promise<void>;
};

const StoreContext = createContext<(StoreState & StoreActions) | null>(null);

const DEFAULT_SETTINGS: Settings = { darkMode: false, accentColor: "default", compactMode: false, fontScale: "md" };
const DEFAULT_STATE: StoreState = { books: [], margins: [], goals: [], settings: DEFAULT_SETTINGS, dataLoading: false };

function rowToBook(r: any): Book {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    coverUrl: r.coverUrl,
    format: (r.format as "book" | "audiobook") ?? "book",
    totalPages: r.totalPages,
    currentPage: r.currentPage,
    durationMinutes: r.durationMinutes,
    currentMinute: r.currentMinute,
    reads: (r.reads as { finishedAt: string }[]) ?? [],
    status: r.status as "reading" | "finished" | "wishlist",
    addedAt: r.addedAt instanceof Date ? r.addedAt.toISOString() : r.addedAt,
  };
}

function rowToMargin(r: any): MarginEntry {
  return {
    id: r.id,
    bookId: r.bookId,
    type: r.type as "note" | "quote",
    text: r.text,
    page: r.page,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

function rowToGoal(r: any): Goal {
  return {
    id: r.id,
    metric: r.metric as "books" | "pages" | "minutes",
    target: r.target,
    timeframe: r.timeframe as "week" | "month" | "year",
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useAuth();
  const [state, setState] = useState<StoreState>({ ...DEFAULT_STATE, dataLoading: !!sessionId });

  const reload = useCallback(async () => {
    if (!sessionId) { setState({ ...DEFAULT_STATE, dataLoading: false }); return; }
    setState((s) => ({ ...s, dataLoading: true }));
    try {
      const res = await dataFns.loadData({ data: { sessionId } });
      setState({
        books: res.books.map(rowToBook),
        margins: res.margins.map(rowToMargin),
        goals: res.goals.map(rowToGoal),
        settings: {
          darkMode: res.settings.darkMode,
          accentColor: res.settings.accentColor,
          compactMode: res.settings.compactMode,
          fontScale: (res.settings.fontScale as "sm" | "md" | "lg") ?? "md",
        },
        dataLoading: false,
      });
    } catch {
      setState((s) => ({ ...s, dataLoading: false }));
    }
  }, [sessionId]);

  useEffect(() => { reload(); }, [reload]);

  const addBook = useCallback(async (b: Omit<Book, "id" | "addedAt"> & { addedAt?: string; extraReads?: string[] }) => {
    if (!sessionId) return;
    const reads: { finishedAt: string }[] = b.reads ?? [];
    if (b.extraReads) {
      for (const d of b.extraReads) reads.push({ finishedAt: d });
    }
    const row = await dataFns.addBook({ data: { sessionId, title: b.title, author: b.author, coverUrl: b.coverUrl ?? undefined, format: b.format ?? "book", totalPages: b.totalPages ?? undefined, durationMinutes: b.durationMinutes ?? undefined, status: b.status ?? "reading", addedAt: b.addedAt, reads } });
    setState((s) => ({ ...s, books: [...s.books, rowToBook(row)] }));
  }, [sessionId]);

  const updateBook = useCallback(async (id: string, patch: Partial<Book>) => {
    if (!sessionId) return;
    const row = await dataFns.updateBook({ data: { sessionId, id, patch: { title: patch.title, author: patch.author, coverUrl: patch.coverUrl, totalPages: patch.totalPages, currentPage: patch.currentPage, durationMinutes: patch.durationMinutes, currentMinute: patch.currentMinute, status: patch.status, reads: patch.reads } } });
    setState((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? rowToBook(row) : b)) }));
  }, [sessionId]);

  const removeBook = useCallback(async (id: string) => {
    if (!sessionId) return;
    await dataFns.removeBook({ data: { sessionId, id } });
    setState((s) => ({ ...s, books: s.books.filter((b) => b.id !== id), margins: s.margins.filter((m) => m.bookId !== id) }));
  }, [sessionId]);

  const finishRead = useCallback(async (id: string, finishedAt?: string) => {
    if (!sessionId) return;
    setState((s) => {
      const book = s.books.find((b) => b.id === id);
      if (!book) return s;
      const newReads = [...book.reads, { finishedAt: finishedAt ?? new Date().toISOString() }];
      const updatedBook = { ...book, status: "finished" as const, currentPage: book.totalPages ?? book.currentPage, reads: newReads };
      dataFns.updateBook({ data: { sessionId, id, patch: { status: "finished", currentPage: book.totalPages ?? book.currentPage ?? 0, reads: newReads } } });
      return { ...s, books: s.books.map((b) => (b.id === id ? updatedBook : b)) };
    });
  }, [sessionId]);

  const addMargin = useCallback(async (m: Omit<MarginEntry, "id" | "createdAt">) => {
    if (!sessionId) return;
    const row = await dataFns.addMargin({ data: { sessionId, bookId: m.bookId, type: m.type, text: m.text, page: m.page ?? undefined } });
    setState((s) => ({ ...s, margins: [rowToMargin(row), ...s.margins] }));
  }, [sessionId]);

  const removeMargin = useCallback(async (id: string) => {
    if (!sessionId) return;
    await dataFns.removeMargin({ data: { sessionId, id } });
    setState((s) => ({ ...s, margins: s.margins.filter((m) => m.id !== id) }));
  }, [sessionId]);

  const addGoal = useCallback(async (g: Omit<Goal, "id" | "createdAt">) => {
    if (!sessionId) return;
    const row = await dataFns.addGoal({ data: { sessionId, metric: g.metric, target: g.target, timeframe: g.timeframe } });
    setState((s) => ({ ...s, goals: [...s.goals, rowToGoal(row)] }));
  }, [sessionId]);

  const removeGoal = useCallback(async (id: string) => {
    if (!sessionId) return;
    await dataFns.removeGoal({ data: { sessionId, id } });
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  }, [sessionId]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    if (!sessionId) return;
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    await dataFns.updateSettings({ data: { sessionId, patch } });
  }, [sessionId]);

  const clearAll = useCallback(async () => {
    if (!sessionId) return;
    await dataFns.clearAllData({ data: { sessionId } });
    setState((s) => ({ ...s, books: [], margins: [], goals: [] }));
  }, [sessionId]);

  return (
    <StoreContext.Provider value={{ ...state, addBook, updateBook, removeBook, finishRead, addMargin, removeMargin, addGoal, removeGoal, updateSettings, clearAll, reload }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be within StoreProvider");
  return ctx;
}

export function readsInYear(book: Book, year: number) {
  return book.reads.filter((r) => new Date(r.finishedAt).getFullYear() === year).length;
}

export function totalReads(book: Book) {
  return book.reads.length;
}

export function lastReadDate(book: Book): string | null {
  if (!book.reads.length) return null;
  return book.reads.map((r) => r.finishedAt).sort().reverse()[0];
}
