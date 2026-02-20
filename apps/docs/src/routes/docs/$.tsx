import { createFileRoute, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import browserCollections from "fumadocs-mdx:collections/browser"
import { DocsContentLayout } from "@/layouts/docs-content-layout"
import {
  DocsPageBody,
  DocsPageHeader,
  DocsPageLayout,
} from "@/components/docs-page"
import { useMDXComponents } from "@/mdx-components"
import { Suspense } from "react"
import type { ComponentData } from "@/types/docs-data"
import type { PageTree } from "@/layouts/sidebar"
import { ComponentDocDataProvider, useComponentDocData } from "@/components/docs-mdx"
import { Route as DocsRoute } from "@/routes/docs"
import { NotFoundState } from "@/components/not-found-state"
import { Button } from "@/components/ui/button/button"
import { getDocsLibrary, inferDocsLibraryFromPath } from "@/lib/docs-library"

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? []
    const data = await serverLoader({ data: slugs })
    if (!data) return null

    let componentData: ComponentData | null = null
    if (data.component && /^[a-z0-9-]+$/.test(data.component)) {
      const mod = await import(`../../generated/components/${data.component}.json`)
      componentData = mod.default as ComponentData
    }

    if (typeof window !== "undefined") {
      await clientLoader.preload(data.path)
    }
    return { ...data, componentData }
  },
  head: ({ loaderData }) => {
    const libraryId = inferDocsLibraryFromPath(loaderData?.path ?? "/docs")
    const library = getDocsLibrary(libraryId)
    return {
      meta: [
        {
          title: `${loaderData?.title ?? "Docs"} - ${library.name}`,
        },
      ],
    }
  },
})

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const { source } = await import("@/lib/source")
    const page = source.getPage(slugs)
    if (!page) return null

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      component: page.data.component,
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
  const { pageTree } = DocsRoute.useLoaderData()

  if (!data) {
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

  return (
    <MdxDocsPage
      path={data.path}
      tree={pageTree}
      componentData={data.componentData}
    />
  )
}

function MdxDocsPage({
  path,
  tree,
  componentData,
}: {
  path: string
  tree: PageTree
  componentData: ComponentData | null
}) {
  return (
    <DocsContentLayout tree={tree}>
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
