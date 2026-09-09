import { createFileRoute } from "@tanstack/react-router";
import { Rowan } from "@/components/rowan/RowanApp";
import { rowanStatus } from "@/lib/rowan-fns";
export const Route = createFileRoute("/margins")({ loader: () => rowanStatus(), component: () => <Rowan {...Route.useLoaderData()} standalone /> });
