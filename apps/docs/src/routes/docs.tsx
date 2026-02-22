import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/docs")({
  component: LegacyDocsRootRedirect,
})

function LegacyDocsRootRedirect() {
  return <Navigate to="/$lib/docs" params={{ lib: "diff-ui" }} replace />
}
