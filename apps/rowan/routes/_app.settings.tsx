import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Rowan — Settings" }] }),
  component: () => null,
});
