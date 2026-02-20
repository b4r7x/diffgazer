import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Header } from "@/layouts/header"
import { Footer } from "@/layouts/footer"
import { DocsContentLayout } from "@/layouts/docs-content-layout"
import type { PageTree } from "@/layouts/sidebar"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"

export const Route = createFileRoute("/docs")({
  loader: async () => docsShellLoader(),
  component: DocsShell,
  notFoundComponent: DocsNotFoundPage,
})

const docsShellLoader = createServerFn({ method: "GET" }).handler(async () => {
  const { source } = await import("@/lib/source")

  return {
    pageTree: source.pageTree as unknown as PageTree,
  }
})

function DocsShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

function DocsNotFoundPage() {
  const { pageTree } = Route.useLoaderData()

  return (
    <DocsContentLayout tree={pageTree}>
      <NotFoundState
        variant="docs"
        title="Documentation page not found"
        description="The page you requested does not exist or was moved."
        primaryAction={(
          <Link to="/docs/$" params={{ _splat: "getting-started/installation" }}>
            <Button variant="primary">Go to getting started</Button>
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
