import browserCollections from "fumadocs-mdx:collections/browser";
import { useKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Pager } from "@diffgazer/ui/components/pager";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Component, type ReactNode, Suspense } from "react";
import { ContentSpinner } from "@/components/content-spinner";
import {
  type ComponentPageData,
  type DocData,
  DocDataProvider,
  type HookPageData,
  useDocData,
} from "@/components/docs-mdx/doc-data-context";
import { DocsContentLayout } from "@/components/layout/content-layout";
import { TuiFaultPanel } from "@/components/layout/tui-fault-panel";
import { DocsPageBody, DocsPageHeader, DocsPageLayout } from "@/components/page-layout";
import {
  type DocsLibraryId,
  docsPath,
  getDocsLibraryConfig,
  parseDocsLibrary,
  routeSplatFromDocsPath,
  sourceSlugsForLibrary,
} from "@/lib/library";
import { loadDocPageData } from "@/lib/load-doc-data";
import { findPageNeighbors, type PageTree } from "@/lib/page-tree";
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

const PAGER_SHORTCUT_CONTROL_SELECTOR =
  'a[href], area[href], audio[controls], button, input, select, summary, textarea, video[controls], [contenteditable]:not([contenteditable="false"])';
const PAGER_SHORTCUT_CONTROL_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "grid",
  "gridcell",
  "link",
  "listbox",
  "menu",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "row",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "tree",
  "treeitem",
]);

function isControlOwnedShortcut(event: KeyboardEvent): boolean {
  const target = event.composedPath()[0] ?? event.target;
  const ownerDocument = (target as { ownerDocument?: Document } | null)?.ownerDocument;
  const ElementConstructor = ownerDocument?.defaultView?.Element;
  if (!ElementConstructor || !(target instanceof ElementConstructor)) return false;
  if (target.closest(PAGER_SHORTCUT_CONTROL_SELECTOR)) return true;

  const roleOwner = target.closest("[role]");
  const role = roleOwner?.getAttribute("role")?.trim().toLowerCase();
  return role !== undefined && PAGER_SHORTCUT_CONTROL_ROLES.has(role);
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
    />
  );
}

function buildDocData(
  componentData: ComponentPageData | null,
  hookData: HookPageData | null,
): DocData | null {
  if (componentData) return { type: "component", data: componentData };
  if (hookData) return { type: "hook", data: hookData };
  return null;
}

class MdxContentErrorBoundary extends Component<
  Readonly<{ children: ReactNode }>,
  Readonly<{ failed: boolean }>
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <TuiFaultPanel
          statusCode="ERR_DOC_CONTENT"
          title="Documentation page unavailable"
          description="The page content could not be loaded. Reload to try again."
          actionLabel="RELOAD_PAGE"
          primaryAction={
            <Button variant="primary" bracket onClick={() => globalThis.location.reload()}>
              Reload page
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export function MdxDocsPage({
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
  componentData: ComponentPageData | null;
  hookData: HookPageData | null;
}) {
  const docData = buildDocData(componentData, hookData);

  return (
    <DocsContentLayout tree={tree} library={library}>
      <DocDataProvider value={docData}>
        <MdxContentErrorBoundary key={path}>
          <Suspense fallback={<ContentSpinner />}>
            <MdxContent path={path} />
          </Suspense>
        </MdxContentErrorBoundary>
      </DocDataProvider>
      <DocsFooterPager pageUrl={pageUrl} tree={tree} library={library} />
    </DocsContentLayout>
  );
}

export function DocsFooterPager({
  pageUrl,
  tree,
  library,
}: {
  pageUrl: string;
  tree: PageTree;
  library: DocsLibraryId;
}) {
  const navigate = useNavigate();
  const { previous, next } = findPageNeighbors(tree, pageUrl);

  useKey("p", (event) => {
    if (isControlOwnedShortcut(event)) return;
    if (!previous) return;
    void navigate({
      to: "/$lib/$",
      params: { lib: library, _splat: routeSplatFromDocsPath(previous.url) },
    });
  });

  useKey("n", (event) => {
    if (isControlOwnedShortcut(event)) return;
    if (!next) return;
    void navigate({
      to: "/$lib/$",
      params: { lib: library, _splat: routeSplatFromDocsPath(next.url) },
    });
  });

  return (
    <Pager>
      {previous && (
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
      )}

      {next ? (
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
      ) : (
        <span className="text-xs font-mono text-muted-foreground">EOF</span>
      )}
    </Pager>
  );
}

function MdxContent({ path }: { path: string }) {
  return clientLoader.useContent(path);
}
