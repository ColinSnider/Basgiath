import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader } from "../components/reader";
import { Journal } from "@/components/rowan/Journal";

export const Route = createFileRoute("/margins")({
  head: () => ({ meta: [{ title: "Margins — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  const { sessionId, openBook } = useReader();
  return <Journal key={sessionId} sessionId={sessionId} openBook={openBook} />;
}
