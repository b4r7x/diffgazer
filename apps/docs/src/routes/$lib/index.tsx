import browserCollections from "fumadocs-mdx:collections/browser";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { ContentSpinner } from "@/components/content-spinner";
import {
	DocsPageBody,
	DocsPageHeader,
	DocsPageLayout,
} from "@/components/docs-page";
import { DocsContentLayout } from "@/layouts/docs-content-layout";
import {
	type DocsLibraryId,
	docsPath,
	getDocsLibraryConfig,
	parseDocsLibrary,
} from "@/lib/docs-library";
import type { PageTree, PageTreeNode } from "@/lib/docs-tree";
import { buildPageSeo } from "@/lib/seo";
import { useMDXComponents } from "@/mdx-components";
import { Route as DocsRoute } from "@/routes/$lib";

interface LoaderData {
	library: DocsLibraryId;
	title: string;
	description?: string;
	mdxPath: string | null;
}

export const Route = createFileRoute("/$lib/")({
	pendingMs: 150,
	component: LibraryIndexPage,
	loader: async ({ params }) => {
		const library = parseDocsLibrary(params.lib);
		const data = await serverLoader({ data: { library } });
		if (data.mdxPath !== null && typeof window !== "undefined") {
			await clientLoader.preload(data.mdxPath);
		}
		return data;
	},
	head: ({ loaderData, params }) => {
		const fallbackLibrary = parseDocsLibrary(params.lib);
		const library = loaderData?.library ?? fallbackLibrary;
		const title = loaderData
			? `${loaderData.title} - ${getDocsLibraryConfig(library).displayName} Docs`
			: `${getDocsLibraryConfig(library).displayName} Docs`;
		const seo = buildPageSeo({
			title,
			description: loaderData?.description,
			pathname: docsPath(library),
		});
		return { meta: seo.meta, links: seo.links };
	},
});

const serverLoader = createServerFn({ method: "GET" })
	.inputValidator((input: { library: DocsLibraryId }) => input)
	.handler(async ({ data }): Promise<LoaderData> => {
		const { source } = await import("@/lib/source");
		const indexPage = source.getPage([data.library]);
		if (indexPage) {
			return {
				library: data.library,
				title: indexPage.data.title,
				description: indexPage.data.description,
				mdxPath: indexPage.path,
			};
		}
		const config = getDocsLibraryConfig(data.library);
		return {
			library: data.library,
			title: config.displayName,
			description: undefined,
			mdxPath: null,
		};
	});

const clientLoader = browserCollections.docs.createClientLoader({
	component({ toc, frontmatter, default: MDX }) {
		return (
			<DocsPageLayout toc={toc} showToc>
				<DocsPageHeader
					title={frontmatter.title}
					description={frontmatter.description}
				/>
				<DocsPageBody>
					<MDX components={useMDXComponents()} />
				</DocsPageBody>
			</DocsPageLayout>
		);
	},
});

function MdxContent({ path }: { path: string }) {
	return clientLoader.useContent(path);
}

function LibraryIndexPage() {
	const data = Route.useLoaderData();
	const { pageTree, library } = DocsRoute.useLoaderData();

	return (
		<DocsContentLayout tree={pageTree} library={library}>
			{data.mdxPath !== null ? (
				<Suspense fallback={<ContentSpinner />}>
					<MdxContent path={data.mdxPath} />
				</Suspense>
			) : (
				<ProgrammaticLibraryLanding
					library={library}
					title={data.title}
					tree={pageTree}
				/>
			)}
		</DocsContentLayout>
	);
}

interface LandingSection {
	name: string;
	items: Array<{ name: string; url: string }>;
}

function collectLandingSections(tree: PageTree): LandingSection[] {
	const sections: LandingSection[] = [];
	let current: LandingSection | null = null;
	for (const node of tree.children) {
		if (node.type === "separator") {
			current = { name: node.name, items: [] };
			sections.push(current);
			continue;
		}
		const item = toLandingItem(node);
		if (!item) continue;
		if (!current) {
			current = { name: tree.name, items: [] };
			sections.push(current);
		}
		current.items.push(item);
	}
	return sections.filter((section) => section.items.length > 0);
}

function toLandingItem(
	node: PageTreeNode,
): { name: string; url: string } | null {
	if (node.type === "page" && node.url) {
		return { name: node.name, url: node.url };
	}
	return null;
}

function ProgrammaticLibraryLanding({
	library,
	title,
	tree,
}: {
	library: DocsLibraryId;
	title: string;
	tree: PageTree;
}) {
	const sections = collectLandingSections(tree);
	const config = getDocsLibraryConfig(library);
	const description = `Documentation for ${config.displayName}.`;
	return (
		<DocsPageLayout toc={[]} showToc={false}>
			<DocsPageHeader title={title} description={description} />
			<DocsPageBody>
				<div className="space-y-8">
					{sections.map((section) => (
						<section key={section.name}>
							<h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">
								{section.name}
							</h2>
							<ul className="space-y-1.5">
								{section.items.map((item) => (
									<li key={item.url}>
										<a
											href={item.url}
											className="text-foreground hover:underline font-mono"
										>
											{item.name}
										</a>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			</DocsPageBody>
		</DocsPageLayout>
	);
}
