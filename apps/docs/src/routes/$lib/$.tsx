import browserCollections from "fumadocs-mdx:collections/browser";
import { Pager } from "@diffgazer/ui/components/pager";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { ContentSpinner } from "@/components/content-spinner";
import {
  type DocData,
  DocDataProvider,
  type HookData,
  useDocData,
} from "@/components/docs-mdx/doc-data-context";
import { DocsContentLayout } from "@/components/layout/content-layout";
import { DocsPageBody, DocsPageHeader, DocsPageLayout } from "@/components/page-layout";
import {
  type DocsLibraryId,
  docsPath,
  getDocsLibraryConfig,
  parseDocsLibrary,
  routeSplatFromDocsPath,
  sourceSlugsForLibrary,
} from "@/lib/library";
import { loadDocData } from "@/lib/load-doc-data";
import { findPageNeighbors, type PageTree } from "@/lib/page-tree";
import { buildPageSeo } from "@/lib/seo";
import { parseDocsPageInput, safeParseDocsPageInput } from "@/lib/server-inputs";
import { useMDXComponents } from "@/mdx-components";
import { Route as DocsRoute } from "@/routes/$lib";
import type { ComponentData } from "@/types/data";

interface LoaderData {
  path: string;
  title: string;
  description?: string;
  component?: string;
  hook?: string;
  library: DocsLibraryId;
}

export const Route = createFileRoute("/$lib/$")({
  pendingMs: 150,
  component: Page,
  loader: async ({ params }) => {
    const library = parseDocsLibrary(params.lib);
    const routeSlugs = params._splat?.split("/").filter(Boolean) ?? [];
    const pageInput = safeParseDocsPageInput({ library, routeSlugs });
    if (!pageInput) throw notFound();

    const data = await serverLoader({ data: pageInput });
    if (!data) throw notFound();

    const [componentData, hookData] = await Promise.all([
      loadDocData<ComponentData>(library, "components", data.component),
      loadDocData<HookData>(library, "hooks", data.hook),
    ]);

    if (typeof window !== "undefined") {
      await clientLoader.preload(data.path);
    }

    return { ...data, componentData, hookData };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const title = `${loaderData.title} - ${getDocsLibraryConfig(loaderData.library).displayName} Docs`;
    const seo = buildPageSeo({
      title,
      description: loaderData.description,
      pathname: docsPath(loaderData.library, params._splat ?? undefined),
    });
    return { meta: seo.meta, links: seo.links };
  },
});

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator(parseDocsPageInput)
  .handler(async ({ data }): Promise<LoaderData | null> => {
    const { source } = await import("@/lib/source");
    const sourceSlugs = sourceSlugsForLibrary(data.library, data.routeSlugs);
    const page = source.getPage(sourceSlugs);
    if (!page) return null;

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      component: page.data.component,
      hook: page.data.hook,
      library: data.library,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }) {
    const showToc = true;
    const docData = useDocData();
    const d = docData?.data;
    const title = d?.title ?? frontmatter.title;
    const description = d?.docs?.description ?? d?.description ?? frontmatter.description;

    return (
      <DocsPageLayout toc={toc} showToc={showToc}>
        <DocsPageHeader title={title} description={description} tags={d?.docs?.tags} />
        <DocsPageBody>
          <MDX components={useMDXComponents()} />
        </DocsPageBody>
      </DocsPageLayout>
    );
  },
});

function Page() {
  const data = Route.useLoaderData();
  const { _splat } = Route.useParams();
  const { pageTree, library } = DocsRoute.useLoaderData();
  const pageUrl = docsPath(library, _splat?.split("/") ?? []);

  return (
    <MdxDocsPage
      path={data.path}
      pageUrl={pageUrl}
      tree={pageTree}
      library={library}
      componentData={data.componentData}
      hookData={data.hookData}
    />
  );
}

function buildDocData(
  componentData: ComponentData | null,
  hookData: HookData | null,
): DocData | null {
  if (componentData) return { type: "component", data: componentData };
  if (hookData) return { type: "hook", data: hookData };
  return null;
}

function MdxDocsPage({
  path,
  pageUrl,
  tree,
  library,
  componentData,
  hookData,
}: {
  path: string;
  pageUrl: string;
  tree: PageTree;
  library: DocsLibraryId;
  componentData: ComponentData | null;
  hookData: HookData | null;
}) {
  const docData = buildDocData(componentData, hookData);

  return (
    <DocsContentLayout tree={tree} library={library}>
      <DocDataProvider value={docData}>
        <Suspense fallback={<ContentSpinner />}>
          <MdxContent path={path} />
        </Suspense>
      </DocDataProvider>
      <DocsFooterPager pageUrl={pageUrl} tree={tree} library={library} />
    </DocsContentLayout>
  );
}

function DocsFooterPager({
  pageUrl,
  tree,
  library,
}: {
  pageUrl: string;
  tree: PageTree;
  library: DocsLibraryId;
}) {
  const { previous, next } = findPageNeighbors(tree, pageUrl);

  return (
    <Pager>
      {previous ? (
        <Pager.Link direction="previous">
          {({ className, rel }) => (
            <Link
              to="/$lib/$"
              params={{
                lib: library,
                _splat: routeSplatFromDocsPath(previous.url),
              }}
              className={className}
              rel={rel}
            >
              <span aria-hidden="true">&larr; </span>
              {`Previous: ${previous.name}`}
            </Link>
          )}
        </Pager.Link>
      ) : (
        <span className="text-xs font-mono text-muted-foreground">EOF</span>
      )}

      {next && (
        <Pager.Link direction="next">
          {({ className, rel }) => (
            <Link
              to="/$lib/$"
              params={{
                lib: library,
                _splat: routeSplatFromDocsPath(next.url),
              }}
              className={className}
              rel={rel}
            >
              {`Next: ${next.name}`}
              <span aria-hidden="true"> &rarr;</span>
            </Link>
          )}
        </Pager.Link>
      )}
    </Pager>
  );
}

function MdxContent({ path }: { path: string }) {
  return clientLoader.useContent(path);
}
