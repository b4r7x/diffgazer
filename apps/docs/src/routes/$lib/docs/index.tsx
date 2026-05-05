import { createFileRoute, Navigate } from "@tanstack/react-router"
import { getDocsLibraryConfig, parseDocsLibrary } from "@/lib/docs-library"

export const Route = createFileRoute("/$lib/docs/")({
  component: DocsLibraryIndexRedirect,
})

function DocsLibraryIndexRedirect() {
  const { lib } = Route.useParams()
  const library = parseDocsLibrary(lib)
  const { defaultRouteSlugs } = getDocsLibraryConfig(library)

  return (
    <Navigate
      to="/$lib/docs/$"
      params={{
        lib: library,
        _splat: defaultRouteSlugs.join("/"),
      }}
      replace
    />
  )
}
