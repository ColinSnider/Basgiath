import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/insights")({
  head: () => ({ meta: [{ title: "Rowan — Insights" }] }),
  component: () => null,
});
