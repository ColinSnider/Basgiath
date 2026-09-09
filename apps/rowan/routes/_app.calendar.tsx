import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/calendar")({
  head: () => ({ meta: [{ title: "Rowan — Calendar" }] }),
  component: () => null,
});
