import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Rowan — Home" }] }),
  component: () => null,
});
