import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/margins")({
  head: () => ({ meta: [{ title: "Rowan — Margins" }] }),
  component: () => null,
});
