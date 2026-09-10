import { createFileRoute } from "@tanstack/react-router";
import { ReaderPage, useReader } from "../components/reader";
import { AccountSettings } from "@/components/rowan/AccountSettings";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Rowan" }] }),
  component: () => (
    <ReaderPage>
      <Page />
    </ReaderPage>
  ),
});

function Page() {
  const { sessionId } = useReader();
  return <AccountSettings sessionId={sessionId} standalone onReplaced={() => {}} />;
}
