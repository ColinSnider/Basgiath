import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader } from "../components/reader";
import { RowanHome } from "@/components/rowan/Home";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  const { sessionId, openBook, goLibrary } = useReader();
  return <RowanHome sessionId={sessionId} openBook={openBook} showLibrary={goLibrary} />;
}
