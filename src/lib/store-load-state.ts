type LoadedSettings = {
  darkMode: boolean;
  accentColor: string;
  compactMode: boolean;
  fontScale?: unknown;
};

type LoadedStoreData<RawBook, RawMargin, RawGoal> = {
  books: RawBook[];
  margins: RawMargin[];
  goals: RawGoal[];
  settings: LoadedSettings;
};

type MergeLoadedStoreStateArgs<PrevState, RawBook, RawMargin, RawGoal, Book, Margin, Goal> = {
  previousState: PrevState;
  loadedData: LoadedStoreData<RawBook, RawMargin, RawGoal>;
  mapBook: (row: RawBook) => Book;
  mapMargin: (row: RawMargin) => Margin;
  mapGoal: (row: RawGoal) => Goal;
};

type StoreStateWithData<Book, Margin, Goal> = {
  books: Book[];
  margins: Margin[];
  goals: Goal[];
  settings: {
    darkMode: boolean;
    accentColor: string;
    compactMode: boolean;
    fontScale: "sm" | "md" | "lg";
  };
  dataLoading: boolean;
};

export function mergeLoadedStoreState<
  PrevState,
  RawBook,
  RawMargin,
  RawGoal,
  Book,
  Margin,
  Goal,
>(
  args: MergeLoadedStoreStateArgs<PrevState, RawBook, RawMargin, RawGoal, Book, Margin, Goal>,
): PrevState & StoreStateWithData<Book, Margin, Goal> {
  const { previousState, loadedData, mapBook, mapMargin, mapGoal } = args;
  const fontScale =
    loadedData.settings.fontScale === "sm" ||
    loadedData.settings.fontScale === "md" ||
    loadedData.settings.fontScale === "lg"
      ? loadedData.settings.fontScale
      : "md";

  return {
    ...previousState,
    books: loadedData.books.map(mapBook),
    margins: loadedData.margins.map(mapMargin),
    goals: loadedData.goals.map(mapGoal),
    settings: {
      darkMode: loadedData.settings.darkMode,
      accentColor: loadedData.settings.accentColor,
      compactMode: loadedData.settings.compactMode,
      fontScale,
    },
    dataLoading: false,
  };
}
