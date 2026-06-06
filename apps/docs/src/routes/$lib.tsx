import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DocsNotFoundBlock } from "@/components/docs-not-found";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import {
	type DocsLibraryId,
	getDocsLibraryConfig,
	isDocsLibraryId,
	PRIMARY_DOCS_LIBRARY_ID,
	parseDocsLibrary,
} from "@/lib/library";
import { fromFumadocsRoot, mapPageTreeForLibrary } from "@/lib/page-tree";

const docsShellLoader = createServerFn({ method: "GET" })
	.inputValidator((input: { library: DocsLibraryId }) => input)
	.handler(async ({ data }) => {
		const { source } = await import("@/lib/source");
		const pageTree = mapPageTreeForLibrary(
			fromFumadocsRoot(source.pageTree),
			data.library,
		);

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
	const { library } = Route.useLoaderData();

	return (
		<div className="flex flex-col h-screen overflow-hidden">
			<Header library={library} />
			<div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
				<Outlet />
			</div>
			<Footer />
		</div>
	);
}

function DocsNotFoundPage() {
	const { pageTree, library } = Route.useLoaderData();
	return <DocsNotFoundBlock tree={pageTree} library={library} />;
}
