type ReadingHistory = { reads: { finishedAt: string }[] };

// Completion history is independent of a book's current status.
export function completedBooks<T extends ReadingHistory>(books: T[]): T[] {
  return books.filter((book) =>
    book.reads.some((read) => Number.isFinite(new Date(read.finishedAt).getTime())),
  );
}

export function completionYears(books: ReadingHistory[]): number[] {
  const years = books.flatMap((book) =>
    book.reads.map((read) => new Date(read.finishedAt).getFullYear()),
  );
  return [...new Set(years)].filter(Number.isFinite).sort((a, b) => b - a);
}
