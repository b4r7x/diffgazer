import { describe, expect, it } from "vitest";
import type { DocsLibraryConfigData } from "@/lib/libraries-config";
import type { LandingSection } from "@/lib/page-tree";
import { buildHomeLibrary, toBrowseRows } from "./data";

const UI_CONFIG = {
	id: "ui",
	displayName: "@diffgazer/ui",
	logoText: "@diffgazer/ui",
	githubUrl: "https://github.com/b4r7x/diffgazer/tree/main/libs/ui",
	enabled: true,
	defaultRouteSlugs: ["getting-started", "installation"],
} satisfies DocsLibraryConfigData;

const SECTIONS: LandingSection[] = [
	{
		name: "Getting Started",
		items: [{ name: "Installation", url: "/ui/getting-started/installation" }],
	},
	{
		name: "Components",
		items: [
			{ name: "Button", url: "/ui/components/button" },
			{ name: "Card", url: "/ui/components/card" },
		],
	},
	{
		name: "Hooks",
		items: [{ name: "useListbox", url: "/ui/hooks/listbox" }],
	},
	{ name: "Project", items: [{ name: "Changelog", url: "/ui/changelog" }] },
];

describe("buildHomeLibrary", () => {
	it("derives section deep links as /$lib/$ splats from the first page", () => {
		const result = buildHomeLibrary(UI_CONFIG, "ui", SECTIONS);
		expect(result.sections).toEqual([
			{
				name: "Getting Started",
				splat: "getting-started/installation",
				count: 1,
			},
			{ name: "Components", splat: "components/button", count: 2 },
			{ name: "Hooks", splat: "hooks/listbox", count: 1 },
		]);
	});

	it("only surfaces curated main sections, dropping the rest", () => {
		const result = buildHomeLibrary(UI_CONFIG, "ui", SECTIONS);
		expect(result.sections.map((s) => s.name)).not.toContain("Project");
	});
});

describe("toBrowseRows", () => {
	it("flattens libraries into one navigable row per section", () => {
		const ui = buildHomeLibrary(UI_CONFIG, "ui", SECTIONS);
		const rows = toBrowseRows([ui]);

		expect(rows).toEqual([
			{
				lib: "ui",
				libraryName: "@diffgazer/ui",
				name: "Getting Started",
				splat: "getting-started/installation",
				count: 1,
			},
			{
				lib: "ui",
				libraryName: "@diffgazer/ui",
				name: "Components",
				splat: "components/button",
				count: 2,
			},
			{
				lib: "ui",
				libraryName: "@diffgazer/ui",
				name: "Hooks",
				splat: "hooks/listbox",
				count: 1,
			},
		]);
	});
});
