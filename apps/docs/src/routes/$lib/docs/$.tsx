import { createFileRoute, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import browserCollections from "fumadocs-mdx:collections/browser"
import { Suspense } from "react"
import { DocsContentLayout } from "@/layouts/docs-content-layout"
import { Route as DocsRoute } from "@/routes/$lib/docs"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"
import {
  DocsPageBody,
  DocsPageHeader,
  DocsPageLayout,
} from "@/components/docs-page"
import { useMDXComponents } from "@/mdx-components"
import type { ComponentData } from "@/types/docs-data"
import { ComponentDocDataProvider, useComponentDocData } from "@/components/docs-mdx"
import {
  getDocsLibraryConfig,
  parseDocsLibrary,
  sourceSlugsForLibrary,
  type DocsLibraryId,
} from "@/lib/docs-library"
import type { PageTree } from "@/lib/docs-tree"

interface LoaderData {
  path: string
  title: string
  description?: string
  component?: string
  library: DocsLibraryId
}

export const Route = createFileRoute("/$lib/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const library = parseDocsLibrary(params.lib)
    const routeSlugs = params._splat?.split("/") ?? []
    const data = await serverLoader({ data: { library, routeSlugs } })
    if (!data) return null

    let componentData: ComponentData | null = null
    if (data.component && /^[a-z0-9-]+$/.test(data.component)) {
      const mod = await import(`../../../generated/components/${data.component}.json`)
      componentData = mod.default as ComponentData
    }

    if (typeof window !== "undefined") {
      await clientLoader.preload(data.path)
    }

    return { ...data, componentData }
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
      library: data.library,
    }
  })

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }) {
    const showToc = typeof frontmatter.component !== "string"
    const componentData = useComponentDocData(frontmatter.component)
    const title = componentData?.title ?? frontmatter.title
    const description = componentData?.docs?.description
      ?? componentData?.description
      ?? frontmatter.description

    return (
      <DocsPageLayout toc={toc} showToc={showToc}>
        <DocsPageHeader
          title={title}
          description={description}
          tags={componentData?.docs?.tags}
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
    />
  )
}

function MdxDocsPage({
  path,
  tree,
  library,
  componentData,
}: {
  path: string
  tree: PageTree
  library: DocsLibraryId
  componentData: ComponentData | null
}) {
  return (
    <DocsContentLayout tree={tree} library={library}>
      <ComponentDocDataProvider value={componentData}>
        <Suspense>
          <MdxContent path={path} />
        </Suspense>
      </ComponentDocDataProvider>
    </DocsContentLayout>
  )
}

function MdxContent({ path }: { path: string }) {
  return clientLoader.useContent(path)
}
