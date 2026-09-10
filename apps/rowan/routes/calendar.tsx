import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader } from "../components/reader";
import { ReadingCalendar } from "@/components/rowan/ReadingCalendar";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "History — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  const { sessionId, openBook } = useReader();
  return <ReadingCalendar sessionId={sessionId} openBook={openBook} />;
}
