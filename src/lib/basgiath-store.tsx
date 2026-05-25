import {
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  useRef,
} from "react";
import { useAuth } from "./auth-context";
import * as dataFns from "./data-fns";
import {
  canUseProtectedActions,
  FULL_AUTH_REQUIRED_MESSAGE,
  MISSING_OR_EXPIRED_SESSION_MESSAGE,
} from "./session-auth.js";
import {
  DEFAULT_PREFERENCES,
  normalizeUserPreferences,
  parseImportJson,
  type UserPreferences,
} from "./user-preferences";
import { mergeLoadedStoreState } from "./store-load-state";

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
  status: "reading" | "finished" | "wishlist" | "dnf";
  addedAt: string;
  metadata?: Record<string, unknown>;
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
  preferences: UserPreferences;
  dataLoading: boolean;
};

type StoreActions = {
  addBook: (
    b: Omit<Book, "id" | "reads" | "addedAt" | "status"> & Partial<Pick<Book, "status">>,
  ) => Promise<void>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  finishRead: (id: string, finishedAt?: string) => Promise<void>;
  addMargin: (m: Omit<MarginEntry, "id" | "createdAt">) => Promise<void>;
  removeMargin: (id: string) => Promise<void>;
  addGoal: (g: Omit<Goal, "id" | "createdAt">) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  importUserData: (rawJson: string) => Promise<void>;
  exportUserData: () => string;
  clearAll: () => Promise<void>;
  reload: () => Promise<void>;
};

const StoreContext = createContext<(StoreState & StoreActions) | null>(null);

const DEFAULT_SETTINGS: Settings = {
  darkMode: false,
  accentColor: "default",
  compactMode: false,
  fontScale: "md",
};
const DEFAULT_STATE: StoreState = {
  books: [],
  margins: [],
  goals: [],
  settings: DEFAULT_SETTINGS,
  preferences: DEFAULT_PREFERENCES,
  dataLoading: false,
};

function storageKey(userId: number | undefined) {
  return userId ? `basgiath:preferences:v1:${userId}` : null;
}

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
    status: r.status as "reading" | "finished" | "wishlist" | "dnf",
    addedAt: r.addedAt instanceof Date ? r.addedAt.toISOString() : r.addedAt,
    metadata: r.metadata ?? {},
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
  const { sessionId, user } = useAuth();
  const [state, setState] = useState<StoreState>({ ...DEFAULT_STATE, dataLoading: !!sessionId });
  const preferencesLoaded = useRef(false);

  const promptAuth = useCallback((message: string) => {
    if (typeof window !== "undefined") window.alert(message);
  }, []);

  const canMutate = useCallback(() => {
    if (!sessionId) {
      promptAuth(MISSING_OR_EXPIRED_SESSION_MESSAGE);
      return false;
    }
    if (!canUseProtectedActions(user)) {
      promptAuth(FULL_AUTH_REQUIRED_MESSAGE);
      return false;
    }
    return true;
  }, [sessionId, user, promptAuth]);

  const getWritableSessionId = useCallback(() => {
    return canMutate() ? sessionId : null;
  }, [canMutate, sessionId]);

  const reload = useCallback(async () => {
    if (!sessionId) {
      setState({ ...DEFAULT_STATE, dataLoading: false });
      return;
    }
    setState((s) => ({ ...s, dataLoading: true }));
    try {
      const res = await dataFns.loadData({ data: { sessionId } });
      setState((s) =>
        mergeLoadedStoreState({
          previousState: s,
          loadedData: res,
          mapBook: rowToBook,
          mapMargin: rowToMargin,
          mapGoal: rowToGoal,
        }),
      );
    } catch {
      setState((s) => ({ ...s, dataLoading: false }));
    }
  }, [sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    preferencesLoaded.current = false;
    const key = storageKey(user?.id);
    if (!key || typeof window === "undefined") {
      setState((s) => ({ ...s, preferences: DEFAULT_PREFERENCES }));
      preferencesLoaded.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      setState((s) => ({ ...s, preferences: normalizeUserPreferences(parsed) }));
    } catch {
      setState((s) => ({ ...s, preferences: DEFAULT_PREFERENCES }));
    } finally {
      preferencesLoaded.current = true;
    }
  }, [user?.id]);

  useEffect(() => {
    const key = storageKey(user?.id);
    if (!key || typeof window === "undefined" || !preferencesLoaded.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state.preferences));
    } catch {
      // Keep runtime resilient if storage is unavailable or quota is exceeded.
    }
  }, [state.preferences, user?.id]);

  const addBook = useCallback(
    async (b: Omit<Book, "id" | "addedAt"> & { addedAt?: string; extraReads?: string[] }) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      const reads: { finishedAt: string }[] = b.reads ?? [];
      if (b.extraReads) {
        for (const d of b.extraReads) reads.push({ finishedAt: d });
      }
      const row = await dataFns.addBook({
        data: {
          sessionId: writableSessionId,
          title: b.title,
          author: b.author,
          coverUrl: b.coverUrl ?? undefined,
          format: b.format ?? "book",
          totalPages: b.totalPages ?? undefined,
          durationMinutes: b.durationMinutes ?? undefined,
          status: b.status ?? "reading",
          addedAt: b.addedAt,
          reads,
          metadata: b.metadata ?? {},
        },
      });
      setState((s) => ({ ...s, books: [...s.books, rowToBook(row)] }));
    },
    [getWritableSessionId],
  );

  const updateBook = useCallback(
    async (id: string, patch: Partial<Book>) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      const row = await dataFns.updateBook({
        data: {
          sessionId: writableSessionId,
          id,
          patch: {
            title: patch.title,
            author: patch.author,
            coverUrl: patch.coverUrl,
            totalPages: patch.totalPages,
            currentPage: patch.currentPage,
            durationMinutes: patch.durationMinutes,
            currentMinute: patch.currentMinute,
            status: patch.status,
            reads: patch.reads,
            metadata: patch.metadata,
          },
        },
      });
      setState((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? rowToBook(row) : b)) }));
    },
    [getWritableSessionId],
  );

  const removeBook = useCallback(
    async (id: string) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      await dataFns.removeBook({ data: { sessionId: writableSessionId, id } });
      setState((s) => ({
        ...s,
        books: s.books.filter((b) => b.id !== id),
        margins: s.margins.filter((m) => m.bookId !== id),
      }));
    },
    [getWritableSessionId],
  );

  const finishRead = useCallback(
    async (id: string, finishedAt?: string) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      setState((s) => {
        const book = s.books.find((b) => b.id === id);
        if (!book) return s;
        const newReads = [...book.reads, { finishedAt: finishedAt ?? new Date().toISOString() }];
        const updatedBook = {
          ...book,
          status: "finished" as const,
          currentPage: book.totalPages ?? book.currentPage,
          reads: newReads,
        };
        dataFns.updateBook({
          data: {
            sessionId: writableSessionId,
            id,
            patch: {
              status: "finished",
              currentPage: book.totalPages ?? book.currentPage ?? 0,
              reads: newReads,
            },
          },
        });
        return { ...s, books: s.books.map((b) => (b.id === id ? updatedBook : b)) };
      });
    },
    [getWritableSessionId],
  );

  const addMargin = useCallback(
    async (m: Omit<MarginEntry, "id" | "createdAt">) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      const row = await dataFns.addMargin({
        data: {
          sessionId: writableSessionId,
          bookId: m.bookId,
          type: m.type,
          text: m.text,
          page: m.page ?? undefined,
        },
      });
      setState((s) => ({ ...s, margins: [rowToMargin(row), ...s.margins] }));
    },
    [getWritableSessionId],
  );

  const removeMargin = useCallback(
    async (id: string) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      await dataFns.removeMargin({ data: { sessionId: writableSessionId, id } });
      setState((s) => ({ ...s, margins: s.margins.filter((m) => m.id !== id) }));
    },
    [getWritableSessionId],
  );

  const addGoal = useCallback(
    async (g: Omit<Goal, "id" | "createdAt">) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      const row = await dataFns.addGoal({
        data: {
          sessionId: writableSessionId,
          metric: g.metric,
          target: g.target,
          timeframe: g.timeframe,
        },
      });
      setState((s) => ({ ...s, goals: [...s.goals, rowToGoal(row)] }));
    },
    [getWritableSessionId],
  );

  const removeGoal = useCallback(
    async (id: string) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      await dataFns.removeGoal({ data: { sessionId: writableSessionId, id } });
      setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
    },
    [getWritableSessionId],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      await dataFns.updateSettings({ data: { sessionId: writableSessionId, patch } });
    },
    [getWritableSessionId],
  );

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setState((s) => ({
      ...s,
      preferences: normalizeUserPreferences({ ...s.preferences, ...patch }),
    }));
  }, []);

  const exportUserData = useCallback(() => {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        books: state.books,
        margins: state.margins,
        goals: state.goals,
        settings: state.settings,
        preferences: state.preferences,
      },
      null,
      2,
    );
  }, [state.books, state.margins, state.goals, state.settings, state.preferences]);

  const importUserData = useCallback(
    async (rawJson: string) => {
      const writableSessionId = getWritableSessionId();
      if (!writableSessionId) return;
      const parsed = parseImportJson(rawJson);
      await dataFns.importUserData({
        data: {
          sessionId: writableSessionId,
          books: parsed.books,
          margins: parsed.margins,
          goals: parsed.goals,
          settings: parsed.settings,
        },
      });
      setState((s) => ({ ...s, preferences: parsed.preferences }));
      await reload();
    },
    [getWritableSessionId, reload],
  );

  const clearAll = useCallback(async () => {
    const writableSessionId = getWritableSessionId();
    if (!writableSessionId) return;
    await dataFns.clearAllData({ data: { sessionId: writableSessionId } });
    setState((s) => ({ ...s, books: [], margins: [], goals: [] }));
  }, [getWritableSessionId]);

  return (
    <StoreContext.Provider
      value={{
        ...state,
        addBook,
        updateBook,
        removeBook,
        finishRead,
        addMargin,
        removeMargin,
        addGoal,
        removeGoal,
        updateSettings,
        updatePreferences,
        exportUserData,
        importUserData,
        clearAll,
        reload,
      }}
    >
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
  return book.reads
    .map((r) => r.finishedAt)
    .sort()
    .reverse()[0];
}
