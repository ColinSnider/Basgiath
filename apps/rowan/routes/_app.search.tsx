import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/search")({
  head: () => ({ meta: [{ title: "Rowan — Find books" }] }),
  component: () => null,
});
