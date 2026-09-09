import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/goals")({
  head: () => ({ meta: [{ title: "Rowan — Goals" }] }),
  component: () => null,
});
