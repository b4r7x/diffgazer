import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DocsNotFoundBlock } from "@/components/docs-not-found";
import {
  getDocsLibraryConfig,
  isDocsLibraryId,
  PRIMARY_DOCS_LIBRARY_ID,
  parseDocsLibrary,
} from "@/lib/library";
import { fromFumadocsRoot, mapPageTreeForLibrary } from "@/lib/page-tree";
import { parseDocsShellInput } from "@/lib/server-inputs";

const docsShellLoader = createServerFn({ method: "GET" })
  .inputValidator(parseDocsShellInput)
  .handler(async ({ data }) => {
    const { source } = await import("@/lib/source");
    const pageTree = mapPageTreeForLibrary(fromFumadocsRoot(source.pageTree), data.library);

    return {
      library: data.library,
      pageTree,
    };
  });

export const Route = createFileRoute("/$lib")({
  pendingMs: 150,
  staleTime: Infinity,
  beforeLoad: ({ params }) => {
    if (!isDocsLibraryId(params.lib)) {
      throw redirect({
        to: "/$lib",
        params: { lib: PRIMARY_DOCS_LIBRARY_ID },
      });
    }

    if (!getDocsLibraryConfig(params.lib).enabled) {
      throw redirect({
        to: "/$lib",
        params: { lib: PRIMARY_DOCS_LIBRARY_ID },
      });
    }
  },
  loader: async ({ params }) =>
    docsShellLoader({ data: { library: parseDocsLibrary(params.lib) } }),
  component: DocsShell,
  notFoundComponent: DocsNotFoundPage,
});

function DocsShell() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}

function DocsNotFoundPage() {
  const { pageTree, library } = Route.useLoaderData();
  return <DocsNotFoundBlock tree={pageTree} library={library} />;
}
