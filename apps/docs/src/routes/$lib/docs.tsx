import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Header } from "@/layouts/header"
import { Footer } from "@/layouts/footer"
import { DocsNotFoundBlock } from "@/components/docs-not-found"
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
    // fumadocs-core PageTree type differs from local definition at the boundary
    const pageTree = mapPageTreeForLibrary(source.pageTree as unknown as PageTree, data.library)

    return {
      library: data.library,
      pageTree,
    }
  })

export const Route = createFileRoute("/$lib/docs")({
  staleTime: Infinity,
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
  return <DocsNotFoundBlock tree={pageTree} library={library} />
}
