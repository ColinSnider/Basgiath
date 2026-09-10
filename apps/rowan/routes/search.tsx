import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage } from "../components/reader";
import { SearchPage } from "../pages/SearchPage";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  return <SearchPage />;
}
