import { createFileRoute } from "@tanstack/react-router";
import { Rowan } from "@/components/rowan/RowanApp";
import { rowanStatus } from "@/lib/rowan-fns";

export const Route = createFileRoute("/account")({
  loader: () => rowanStatus(),
  component: () => <Rowan {...Route.useLoaderData()} standalone />,
});
