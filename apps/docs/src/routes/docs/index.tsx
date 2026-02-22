import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/")({
  component: () => (
    <Navigate
      to="/$lib/docs/$"
      params={{ lib: "diff-ui", _splat: "getting-started/installation" }}
      replace
    />
  ),
})
