import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader } from "../components/reader";
import { Goals } from "@/components/rowan/Goals";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [{ title: "Goals — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  const { sessionId } = useReader();
  return <Goals sessionId={sessionId} />;
}
