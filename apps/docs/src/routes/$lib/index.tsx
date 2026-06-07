import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { parseDocsLibrary, routeSplatFromDocsPath } from "@/lib/library";
import {
	firstNavigablePage,
	fromFumadocsRoot,
	mapPageTreeForLibrary,
} from "@/lib/page-tree";
import { parseDocsShellInput } from "@/lib/server-inputs";

const resolveFirstPageSplat = createServerFn({ method: "GET" })
	.inputValidator(parseDocsShellInput)
	.handler(async ({ data }): Promise<string | null> => {
		const { source } = await import("@/lib/source");
		const tree = mapPageTreeForLibrary(
			fromFumadocsRoot(source.pageTree),
			data.library,
		);
		const firstPage = firstNavigablePage(tree);
		if (!firstPage) return null;
		return routeSplatFromDocsPath(firstPage.url);
	});

export const Route = createFileRoute("/$lib/")({
	loader: async ({ params }) => {
		const library = parseDocsLibrary(params.lib);
		const splat = await resolveFirstPageSplat({ data: { library } });
		if (!splat) throw notFound();
		throw redirect({
			to: "/$lib/$",
			params: { lib: library, _splat: splat },
			replace: true,
		});
	},
});
