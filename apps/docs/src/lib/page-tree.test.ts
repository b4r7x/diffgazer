import { describe, expect, it } from "vitest";
import {
	collectLandingSections,
	findPageNeighbors,
	firstNavigablePage,
	mapPageTreeForLibrary,
	type PageTree,
} from "@/lib/page-tree";

const SOURCE_TREE: PageTree = {
	name: "Documentation",
	children: [
		{
			type: "folder",
			name: "ui",
			url: "/docs/ui",
			children: [
				{
					type: "separator",
					name: "---Getting Started---",
				},
				{
					type: "page",
					name: "installation",
					url: "/docs/ui/getting-started/installation",
				},
			],
		},
		{
			type: "folder",
			name: "keys",
			url: "/docs/keys",
			children: [
				{
					type: "separator",
					name: "---Guides---",
				},
				{
					type: "page",
					name: "navigation",
					url: "/docs/keys/guides/navigation",
				},
			],
		},
	],
};

describe("mapPageTreeForLibrary", () => {
	it("keeps only active library nodes and rewrites urls", () => {
		const uiTree = mapPageTreeForLibrary(SOURCE_TREE, "ui");
		expect(uiTree.children).toEqual([
			{ type: "separator", name: "---Getting Started---" },
			{
				type: "page",
				name: "installation",
				url: "/ui/getting-started/installation",
			},
		]);

		const keysTree = mapPageTreeForLibrary(SOURCE_TREE, "keys");
		expect(keysTree.children).toEqual([
			{ type: "separator", name: "---Guides---" },
			{
				type: "page",
				name: "navigation",
				url: "/keys/guides/navigation",
			},
		]);
	});

	// fumadocs spreads `...folder` into flat inline pages, so the real merged
	// root is a flat list where each library block opens with its own leading
	// separator. Scoping to one library must keep that first section's header.
	it("keeps the leading section header for the scoped library", () => {
		const mergedRoot: PageTree = {
			name: "Documentation",
			children: [
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Overview", url: "/docs/ui/getting-started" },
				{ type: "separator", name: "Components" },
				{ type: "page", name: "Button", url: "/docs/ui/components/button" },
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Intro", url: "/docs/keys/getting-started" },
				{ type: "separator", name: "Hooks" },
				{ type: "page", name: "useKey", url: "/docs/keys/hooks/use-key" },
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Quickstart", url: "/docs/app/getting-started" },
				{ type: "separator", name: "Concepts" },
				{ type: "page", name: "Reviews", url: "/docs/app/concepts/reviews" },
			],
		};

		for (const [library, firstUrl] of [
			["ui", "/ui/getting-started"],
			["keys", "/keys/getting-started"],
			["app", "/app/getting-started"],
		] as const) {
			const tree = mapPageTreeForLibrary(mergedRoot, library);
			expect(tree.children[0]).toEqual({
				type: "separator",
				name: "Getting Started",
			});
			expect(tree.children[1]).toMatchObject({ url: firstUrl });
			// no empty separators leaked in from the other libraries' blocks
			const separators = tree.children.filter((n) => n.type === "separator");
			for (let i = 0; i < tree.children.length; i++) {
				if (tree.children[i]?.type !== "separator") continue;
				expect(tree.children[i + 1]?.type).toBe("page");
			}
			expect(separators[0]?.name).toBe("Getting Started");
		}
	});
});

describe("findPageNeighbors", () => {
	const tree: PageTree = {
		name: "@diffgazer/ui",
		children: [
			{
				type: "page",
				name: "Getting Started",
				url: "@diffgazer/ui/getting-started",
			},
			{
				type: "page",
				name: "Installation",
				url: "@diffgazer/ui/getting-started/installation",
			},
			{
				type: "page",
				name: "Consumption Modes",
				url: "@diffgazer/ui/getting-started/consumption-modes",
			},
		],
	};

	it("returns the surrounding pages in sidebar order", () => {
		expect(
			findPageNeighbors(tree, "@diffgazer/ui/getting-started/installation"),
		).toEqual({
			previous: {
				name: "Getting Started",
				url: "@diffgazer/ui/getting-started",
			},
			next: {
				name: "Consumption Modes",
				url: "@diffgazer/ui/getting-started/consumption-modes",
			},
		});
	});

	it("has no previous for the first page and no next for the last", () => {
		const first = findPageNeighbors(tree, "@diffgazer/ui/getting-started");
		expect(first.previous).toBeNull();
		expect(first.next?.url).toBe("@diffgazer/ui/getting-started/installation");

		const last = findPageNeighbors(
			tree,
			"@diffgazer/ui/getting-started/consumption-modes",
		);
		expect(last.next).toBeNull();
		expect(last.previous?.url).toBe(
			"@diffgazer/ui/getting-started/installation",
		);
	});

	it("returns no neighbors when the url is not a navigable page", () => {
		expect(findPageNeighbors(tree, "/ui")).toEqual({
			previous: null,
			next: null,
		});
	});

	// Production trees interleave separators between sections and group some
	// pages under url-less folders. The pager receives that separator-bearing
	// tree, so neighbors of a middle page must skip the separator/folder
	// boundary and resolve to the adjacent navigable pages on either side.
	it("skips separators and folders to resolve neighbors across section boundaries", () => {
		const sectionedTree: PageTree = {
			name: "@diffgazer/keys",
			children: [
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Overview", url: "/keys/getting-started" },
				{ type: "separator", name: "Hooks" },
				{ type: "page", name: "useKey", url: "/keys/hooks/use-key" },
				{
					type: "folder",
					name: "Guides",
					children: [
						{
							type: "page",
							name: "Navigation",
							url: "/keys/guides/navigation",
						},
					],
				},
			],
		};

		expect(findPageNeighbors(sectionedTree, "/keys/hooks/use-key")).toEqual({
			previous: { name: "Overview", url: "/keys/getting-started" },
			next: { name: "Navigation", url: "/keys/guides/navigation" },
		});
	});
});

describe("firstNavigablePage", () => {
	it("returns the first page after a leading separator", () => {
		const tree: PageTree = {
			name: "@diffgazer/app",
			children: [
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Introduction", url: "/app/getting-started" },
				{ type: "separator", name: "Concepts" },
				{ type: "page", name: "Reviews", url: "/app/concepts/reviews" },
			],
		};

		expect(firstNavigablePage(tree)).toEqual({
			name: "Introduction",
			url: "/app/getting-started",
		});
	});

	it("descends into a leading folder to find the first page", () => {
		const tree: PageTree = {
			name: "@diffgazer/ui",
			children: [
				{
					type: "folder",
					name: "Getting Started",
					children: [
						{
							type: "page",
							name: "Installation",
							url: "@diffgazer/ui/getting-started/installation",
						},
					],
				},
			],
		};

		expect(firstNavigablePage(tree)).toEqual({
			name: "Installation",
			url: "@diffgazer/ui/getting-started/installation",
		});
	});

	it("returns null when the tree has no navigable page", () => {
		const tree: PageTree = {
			name: "@diffgazer/ui",
			children: [
				{ type: "separator", name: "Empty" },
				{ type: "folder", name: "Grouped", children: [] },
			],
		};

		expect(firstNavigablePage(tree)).toBeNull();
	});

	// The bare library root redirects to this page; it must equal the first item
	// the sidebar renders for the scoped library, derived from the same mapped tree.
	it("derives the scoped library's first page as the redirect target", () => {
		const mergedRoot: PageTree = {
			name: "Documentation",
			children: [
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Overview", url: "/docs/ui/getting-started" },
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Intro", url: "/docs/keys/getting-started" },
				{ type: "separator", name: "Getting Started" },
				{ type: "page", name: "Quickstart", url: "/docs/app/getting-started" },
			],
		};

		for (const [library, firstUrl] of [
			["ui", "/ui/getting-started"],
			["keys", "/keys/getting-started"],
			["app", "/app/getting-started"],
		] as const) {
			const tree = mapPageTreeForLibrary(mergedRoot, library);
			expect(firstNavigablePage(tree)?.url).toBe(firstUrl);
		}
	});
});

describe("collectLandingSections", () => {
	it("groups pages under the separator that precedes them", () => {
		const tree: PageTree = {
			name: "@diffgazer/ui",
			children: [
				{ type: "separator", name: "Getting Started" },
				{
					type: "page",
					name: "Installation",
					url: "@diffgazer/ui/getting-started/installation",
				},
				{ type: "separator", name: "Components" },
				{
					type: "page",
					name: "Button",
					url: "@diffgazer/ui/components/button",
				},
				{ type: "page", name: "Card", url: "@diffgazer/ui/components/card" },
			],
		};

		expect(collectLandingSections(tree)).toEqual([
			{
				name: "Getting Started",
				items: [
					{
						name: "Installation",
						url: "@diffgazer/ui/getting-started/installation",
					},
				],
			},
			{
				name: "Components",
				items: [
					{ name: "Button", url: "@diffgazer/ui/components/button" },
					{ name: "Card", url: "@diffgazer/ui/components/card" },
				],
			},
		]);
	});

	it("falls back to the tree name for pages before the first separator", () => {
		const tree: PageTree = {
			name: "@diffgazer/keys",
			children: [
				{ type: "page", name: "Overview", url: "/keys/overview" },
				{ type: "separator", name: "Hooks" },
				{ type: "page", name: "useKey", url: "/keys/hooks/use-key" },
			],
		};

		const sections = collectLandingSections(tree);
		expect(sections[0]).toEqual({
			name: "@diffgazer/keys",
			items: [{ name: "Overview", url: "/keys/overview" }],
		});
		expect(sections[1]?.name).toBe("Hooks");
	});

	it("drops empty sections and skips url-less nodes", () => {
		const tree: PageTree = {
			name: "@diffgazer/ui",
			children: [
				{ type: "separator", name: "Components" },
				{
					type: "page",
					name: "Button",
					url: "@diffgazer/ui/components/button",
				},
				{ type: "separator", name: "Empty" },
				{ type: "folder", name: "Grouped", children: [] },
			],
		};

		const sections = collectLandingSections(tree);
		expect(sections).toHaveLength(1);
		expect(sections[0]?.name).toBe("Components");
		expect(sections[0]?.items).toEqual([
			{ name: "Button", url: "@diffgazer/ui/components/button" },
		]);
	});
});
