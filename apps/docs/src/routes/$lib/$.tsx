import browserCollections from "fumadocs-mdx:collections/browser";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useDocData } from "@/components/docs-mdx/doc-data-context";
import { MdxDocsPage } from "@/components/docs-mdx/page";
import { DocsPageBody, DocsPageHeader, DocsPageLayout } from "@/components/page-layout";
import {
  type DocsLibraryId,
  docsPath,
  getDocsLibraryConfig,
  parseDocsLibrary,
  sourceSlugsForLibrary,
} from "@/lib/library";
import { loadDocPageData } from "@/lib/load-doc-data";
import { buildPageSeo } from "@/lib/seo";
import { parseDocsPageInput, safeParseDocsPageInput } from "@/lib/server-inputs";
import { useMDXComponents } from "@/mdx-components";
import { Route as DocsRoute } from "@/routes/$lib";

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
      loadDocPageData(library, "components", data.component, { throwIfMissing: true }),
      loadDocPageData(library, "hooks", data.hook, { throwIfMissing: true }),
    ]);

    return {
      ...data,
      componentData,
      hookData,
    };
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
    const { lib, _splat } = Route.useParams();
    const docData = useDocData();
    const d = docData?.data;
    const title = d?.title ?? frontmatter.title;
    const description = d?.docs?.description ?? d?.description ?? frontmatter.description;

    return (
      <DocsPageLayout toc={toc}>
        <DocsPageHeader
          title={title}
          description={description}
          tags={d?.docs?.tags}
          lib={lib}
          slug={_splat}
        />
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
    >
      <MdxContent path={data.path} />
    </MdxDocsPage>
  );
}

function MdxContent({ path }: { path: string }) {
  return clientLoader.useContent(path);
}
