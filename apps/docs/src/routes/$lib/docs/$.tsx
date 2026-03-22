import { createFileRoute, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import browserCollections from "fumadocs-mdx:collections/browser"
import { Suspense } from "react"
import { DocsContentLayout } from "@/layouts/docs-content-layout"
import { Route as DocsRoute } from "@/routes/$lib/docs"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"
import { Spinner } from "@/components/ui/spinner/spinner"
import {
  DocsPageBody,
  DocsPageHeader,
  DocsPageLayout,
} from "@/components/docs-page"
import { useMDXComponents } from "@/mdx-components"
import type { ComponentData } from "@/types/docs-data"
import { DocDataProvider, useDocData, type DocData, type HookData } from "@/components/docs-mdx/doc-data-context"
import {
  getDocsLibraryConfig,
  parseDocsLibrary,
  sourceSlugsForLibrary,
  type DocsLibraryId,
} from "@/lib/docs-library"
import { loadDocData } from "@/lib/load-doc-data"
import type { PageTree } from "@/lib/docs-tree"

interface LoaderData {
  path: string
  title: string
  description?: string
  component?: string
  hook?: string
  library: DocsLibraryId
}

export const Route = createFileRoute("/$lib/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const library = parseDocsLibrary(params.lib)
    const routeSlugs = params._splat?.split("/") ?? []
    const data = await serverLoader({ data: { library, routeSlugs } })
    if (!data) return null

    const componentData = await loadDocData<ComponentData>(library, "components", data.component)
    const hookData = await loadDocData<HookData>(library, "hooks", data.hook, { optional: true })

    if (typeof window !== "undefined") {
      await clientLoader.preload(data.path)
    }

    return { ...data, componentData, hookData }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.title} - ${getDocsLibraryConfig(loaderData.library).displayName} Docs`
          : "Docs - diffgazer",
      },
    ],
  }),
})

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((input: { library: DocsLibraryId; routeSlugs: string[] }) => input)
  .handler(async ({ data }): Promise<LoaderData | null> => {
    const { source } = await import("@/lib/source")
    const sourceSlugs = sourceSlugsForLibrary(data.library, data.routeSlugs)
    const page = source.getPage(sourceSlugs)
    if (!page) return null

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      component: page.data.component,
      hook: page.data.hook,
      library: data.library,
    }
  })

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }) {
    const showToc = true
    const docData = useDocData()
    const d = docData?.data
    const title = d?.title ?? frontmatter.title
    const description = d?.docs?.description
      ?? d?.description
      ?? frontmatter.description

    return (
      <DocsPageLayout toc={toc} showToc={showToc}>
        <DocsPageHeader
          title={title}
          description={description}
          tags={d?.docs?.tags}
        />
        <DocsPageBody>
          <MDX components={useMDXComponents()} />
        </DocsPageBody>
      </DocsPageLayout>
    )
  },
})

function Page() {
  const data = Route.useLoaderData()
  const { pageTree, library } = DocsRoute.useLoaderData()
  const { defaultRouteSlugs } = getDocsLibraryConfig(library)

  if (!data) {
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

  return (
    <MdxDocsPage
      path={data.path}
      tree={pageTree}
      library={library}
      componentData={data.componentData}
      hookData={data.hookData}
    />
  )
}

function ContentSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size="md">loading...</Spinner>
    </div>
  )
}

function buildDocData(componentData: ComponentData | null, hookData: HookData | null): DocData | null {
  if (componentData) return { type: "component", data: componentData }
  if (hookData) return { type: "hook", data: hookData }
  return null
}

function MdxDocsPage({
  path,
  tree,
  library,
  componentData,
  hookData,
}: {
  path: string
  tree: PageTree
  library: DocsLibraryId
  componentData: ComponentData | null
  hookData: HookData | null
}) {
  const docData = buildDocData(componentData, hookData)

  return (
    <DocsContentLayout tree={tree} library={library}>
      <DocDataProvider value={docData}>
        <Suspense fallback={<ContentSpinner />}>
          <MdxContent path={path} />
        </Suspense>
      </DocDataProvider>
    </DocsContentLayout>
  )
}

function MdxContent({ path }: { path: string }) {
  return clientLoader.useContent(path)
}
