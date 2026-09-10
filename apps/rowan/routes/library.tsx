import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage } from "../components/reader";
import { LibraryPage } from "../pages/LibraryPage";

export const Route = createFileRoute("/library")({
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
