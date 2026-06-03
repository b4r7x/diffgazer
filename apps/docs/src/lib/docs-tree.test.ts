import { describe, expect, it } from "vitest";
import {
	collectLandingSections,
	mapPageTreeForLibrary,
	type PageTree,
} from "@/lib/docs-tree";

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
		expect(uiTree.children).toHaveLength(1);
		expect(uiTree.children[0]).toEqual({
			type: "page",
			name: "installation",
			url: "/ui/getting-started/installation",
		});

		const keysTree = mapPageTreeForLibrary(SOURCE_TREE, "keys");
		expect(keysTree.children).toHaveLength(1);
		expect(keysTree.children[0]).toEqual({
			type: "page",
			name: "navigation",
			url: "/keys/guides/navigation",
		});
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
					url: "/ui/getting-started/installation",
				},
				{ type: "separator", name: "Components" },
				{ type: "page", name: "Button", url: "/ui/components/button" },
				{ type: "page", name: "Card", url: "/ui/components/card" },
			],
		};

		expect(collectLandingSections(tree)).toEqual([
			{
				name: "Getting Started",
				items: [
					{ name: "Installation", url: "/ui/getting-started/installation" },
				],
			},
			{
				name: "Components",
				items: [
					{ name: "Button", url: "/ui/components/button" },
					{ name: "Card", url: "/ui/components/card" },
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
				{ type: "page", name: "Button", url: "/ui/components/button" },
				{ type: "separator", name: "Empty" },
				{ type: "folder", name: "Grouped", children: [] },
			],
		};

		const sections = collectLandingSections(tree);
		expect(sections).toHaveLength(1);
		expect(sections[0]?.name).toBe("Components");
		expect(sections[0]?.items).toEqual([
			{ name: "Button", url: "/ui/components/button" },
		]);
	});
});
