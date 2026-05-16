import { useEffect, useState, useCallback } from "react";

export type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages?: number;
  /** Reading sessions: each entry = one full read with finished date (ISO) */
  reads: { finishedAt: string }[];
  /** Current progress for in-progress book */
  currentPage?: number;
  status: "reading" | "finished" | "wishlist";
  addedAt: string;
};

export type MarginEntry = {
  id: string;
  bookId: string;
  type: "note" | "quote";
  text: string;
  page?: number;
  createdAt: string;
};

export type Goal = {
  id: string;
  metric: "books" | "pages" | "minutes";
  target: number;
  timeframe: "week" | "month" | "year";
  createdAt: string;
};

export type Profile = {
  name: string;
  darkMode: boolean;
};

type Store = {
  books: Book[];
  margins: MarginEntry[];
  goals: Goal[];
  profile: Profile;
};

const KEY = "basgiath:v1";

const defaultStore: Store = {
  books: [],
  margins: [],
  goals: [
    { id: "g1", metric: "books", target: 24, timeframe: "year", createdAt: new Date().toISOString() },
  ],
  profile: { name: "Reader", darkMode: false },
};

function load(): Store {
  if (typeof window === "undefined") return defaultStore;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStore;
    return { ...defaultStore, ...JSON.parse(raw) };
  } catch {
    return defaultStore;
  }
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

const listeners = new Set<() => void>();
let state: Store | null = null;

function getState() {
  if (state === null) state = load();
  return state;
}

function setState(updater: (s: Store) => Store) {
  state = updater(getState());
  save(state);
  listeners.forEach((l) => l());
}

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    // hydrate from localStorage on mount
    state = load();
    force((n) => n + 1);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const data = getState();

  const addBook = useCallback((b: Omit<Book, "id" | "reads" | "addedAt" | "status"> & Partial<Pick<Book, "status">>) => {
    setState((s) => ({
      ...s,
      books: [
        ...s.books,
        {
          ...b,
          id: crypto.randomUUID(),
          reads: [],
          addedAt: new Date().toISOString(),
          status: b.status ?? "reading",
        },
      ],
    }));
  }, []);

  const updateBook = useCallback((id: string, patch: Partial<Book>) => {
    setState((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  }, []);

  const removeBook = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      books: s.books.filter((b) => b.id !== id),
      margins: s.margins.filter((m) => m.bookId !== id),
    }));
  }, []);

  const finishRead = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      books: s.books.map((b) =>
        b.id === id
          ? {
              ...b,
              status: "finished",
              currentPage: b.totalPages,
              reads: [...b.reads, { finishedAt: new Date().toISOString() }],
            }
          : b
      ),
    }));
  }, []);

  const addMargin = useCallback((m: Omit<MarginEntry, "id" | "createdAt">) => {
    setState((s) => ({
      ...s,
      margins: [{ ...m, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...s.margins],
    }));
  }, []);

  const removeMargin = useCallback((id: string) => {
    setState((s) => ({ ...s, margins: s.margins.filter((m) => m.id !== id) }));
  }, []);

  const addGoal = useCallback((g: Omit<Goal, "id" | "createdAt">) => {
    setState((s) => ({
      ...s,
      goals: [...s.goals, { ...g, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
    }));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  }, []);

  const updateProfile = useCallback((p: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  }, []);

  return {
    ...data,
    addBook,
    updateBook,
    removeBook,
    finishRead,
    addMargin,
    removeMargin,
    addGoal,
    removeGoal,
    updateProfile,
  };
}

/* Selectors */

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
