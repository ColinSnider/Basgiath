import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "../components/Welcome";

export const Route = createFileRoute("/login")({ component: Welcome });
