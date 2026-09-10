import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader, useReadingCommands } from "../components/reader";
import { Insights } from "@/components/rowan/Insights";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  const { sessionId } = useReader();
  const { run, busy, feedback } = useReadingCommands();
  return (
    <>
      {feedback}
      <Insights sessionId={sessionId} run={run} busy={busy} />
    </>
  );
}
