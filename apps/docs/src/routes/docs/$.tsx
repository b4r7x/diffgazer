import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/docs/$")({
  component: LegacyDocsSplatRedirect,
})

function LegacyDocsSplatRedirect() {
  const { _splat } = Route.useParams()

  return (
    <Navigate
      to="/$lib/docs/$"
      params={{
        lib: "diff-ui",
        _splat: _splat ?? "getting-started/installation",
      }}
      replace
    />
  )
}
