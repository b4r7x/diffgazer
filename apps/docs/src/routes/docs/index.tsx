import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/")({
  component: () => (
    <Navigate to="/docs/$" params={{ _splat: "getting-started/installation" }} />
  ),
})
