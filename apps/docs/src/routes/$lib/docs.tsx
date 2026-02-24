import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Header } from "@/layouts/header"
import { Footer } from "@/layouts/footer"
import { DocsContentLayout } from "@/layouts/docs-content-layout"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"
import {
  getDocsLibraryConfig,
  isDocsLibraryId,
  parseDocsLibrary,
  PRIMARY_DOCS_LIBRARY_ID,
  type DocsLibraryId,
} from "@/lib/docs-library"
import { mapPageTreeForLibrary, type PageTree } from "@/lib/docs-tree"

const docsShellLoader = createServerFn({ method: "GET" })
  .inputValidator((input: { library: DocsLibraryId }) => input)
  .handler(async ({ data }) => {
    const { source } = await import("@/lib/source")
    const pageTree = mapPageTreeForLibrary(source.pageTree as unknown as PageTree, data.library)

    return {
      library: data.library,
      pageTree,
    }
  })

export const Route = createFileRoute("/$lib/docs")({
  beforeLoad: ({ params }) => {
    if (!isDocsLibraryId(params.lib)) {
      throw redirect({
        to: "/$lib/docs",
        params: { lib: PRIMARY_DOCS_LIBRARY_ID },
      })
    }

    if (!getDocsLibraryConfig(params.lib).enabled) {
      throw redirect({
        to: "/$lib/docs",
        params: { lib: PRIMARY_DOCS_LIBRARY_ID },
      })
    }
  },
  loader: async ({ params }) => docsShellLoader({ data: { library: parseDocsLibrary(params.lib) } }),
  component: DocsShell,
  notFoundComponent: DocsNotFoundPage,
})

function DocsShell() {
  const { library } = Route.useLoaderData()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header library={library} />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

function DocsNotFoundPage() {
  const { pageTree, library } = Route.useLoaderData()
  const { defaultRouteSlugs } = getDocsLibraryConfig(library)

  return (
    <DocsContentLayout tree={pageTree} library={library}>
      <NotFoundState
        variant="docs"
        title="Documentation page not found"
        description="The page you requested does not exist or was moved."
        primaryAction={(
          <Link
            to="/$lib/docs/$"
            params={{ lib: library, _splat: defaultRouteSlugs.join("/") }}
          >
            <Button variant="primary">Go to docs home</Button>
          </Link>
        )}
        secondaryAction={(
          <Link to="/">
            <Button variant="ghost">Go home</Button>
          </Link>
        )}
      />
    </DocsContentLayout>
  )
}
