import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage } from "../components/reader";
import { BookPage } from "../pages/BookPage";

export const Route = createFileRoute("/books/$bookId")({
  head: () => ({ meta: [{ title: "Book details — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <BookPage />
    </ReaderPage>
  ),
});
