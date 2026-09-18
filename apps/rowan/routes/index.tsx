import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader } from "../components/reader";
import { RowanHome } from "@/components/rowan/Home";
import { HomeHero } from "@/components/rowan/HomeHero";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Rowan" }] }),
  component: () => (
    <>
      <HomeHero />
      <ReaderPage>
        <Page />
      </ReaderPage>
    </>
  ),
});

function Page() {
  const { sessionId, openBook, goLibrary } = useReader();
  return <RowanHome sessionId={sessionId} openBook={openBook} showLibrary={goLibrary} />;
}
