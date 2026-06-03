import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HomeView } from "@/features/home/components/home-view";
import { buildHomeLibrary, type HomeLibrary } from "@/features/home/home-data";
import { getEnabledDocsLibraries, parseDocsLibrary } from "@/lib/docs-library";
import {
	collectLandingSections,
	fromFumadocsRoot,
	mapPageTreeForLibrary,
} from "@/lib/docs-tree";
import { buildPageSeo } from "@/lib/seo";

const homeLoader = createServerFn({ method: "GET" }).handler(
	async (): Promise<{ libraries: HomeLibrary[] }> => {
		const { source } = await import("@/lib/source");
		const root = fromFumadocsRoot(source.pageTree);

		const libraries = getEnabledDocsLibraries().map((config) => {
			const library = parseDocsLibrary(config.id);
			const sections = collectLandingSections(
				mapPageTreeForLibrary(root, library),
			);
			return buildHomeLibrary(config, library, sections);
		});

		return { libraries };
	},
);

export const Route = createFileRoute("/")({
	component: HomePage,
	loader: () => homeLoader(),
	head: () => {
		const seo = buildPageSeo({
			title: "diffgazer docs",
			pathname: "/",
			type: "website",
		});
		return { meta: seo.meta, links: seo.links };
	},
});

function HomePage() {
	const { libraries } = Route.useLoaderData();
	return <HomeView libraries={libraries} />;
}
