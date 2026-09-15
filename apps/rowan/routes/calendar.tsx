import { Insights } from "@/components/rowan/Insights";
import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader, useReadingCommands } from "../components/reader";
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
  const { run, busy, feedback } = useReadingCommands();
  return (
    <div className="reader-history-unified">
      {feedback}
      <Insights sessionId={sessionId} run={run} busy={busy} />
      <ReadingCalendar sessionId={sessionId} openBook={openBook} />
    </div>
  );
}
