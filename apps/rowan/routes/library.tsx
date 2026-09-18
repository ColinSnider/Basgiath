import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage } from "../components/reader";
import { LibraryPage } from "../pages/LibraryPage";
import { librarySearch } from "../components/library-search";

export const Route = createFileRoute("/library")({
  validateSearch: (search) => librarySearch.parse(search),
  head: () => ({ meta: [{ title: "Library — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  return <LibraryPage />;
}
