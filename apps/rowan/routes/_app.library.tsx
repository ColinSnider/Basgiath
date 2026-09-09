import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: "Rowan — All books" }] }),
  component: () => null,
});
