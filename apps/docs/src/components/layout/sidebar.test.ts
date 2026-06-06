import type { MouseEvent } from "react";
import { describe, expect, it } from "vitest";
import type { PageTreeNode } from "@/lib/page-tree";
import {
	findSectionIndexUrl,
	groupBySection,
	isPrimaryNavigationClick,
	sidebarItemLabel,
} from "./sidebar";

function page(name: string, url: string): PageTreeNode {
	return { type: "page", name, url };
}

function clickEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
	return {
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		...overrides,
	} as MouseEvent;
}

describe("isPrimaryNavigationClick", () => {
	it("accepts an unmodified left click", () => {
		expect(isPrimaryNavigationClick(clickEvent())).toBe(true);
	});

	it("rejects middle/right clicks and modifier clicks (open-in-new-tab gestures)", () => {
		expect(isPrimaryNavigationClick(clickEvent({ button: 1 }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ button: 2 }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ metaKey: true }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ ctrlKey: true }))).toBe(false);
		expect(isPrimaryNavigationClick(clickEvent({ shiftKey: true }))).toBe(
			false,
		);
		expect(isPrimaryNavigationClick(clickEvent({ altKey: true }))).toBe(false);
	});
});

describe("groupBySection", () => {
	it("titles the first section from its leading separator", () => {
		const children: PageTreeNode[] = [
			{ type: "separator", name: "Getting Started" },
			{ type: "page", name: "Overview", url: "@diffgazer/ui/getting-started" },
			{ type: "separator", name: "Components" },
			{ type: "page", name: "Button", url: "@diffgazer/ui/components/button" },
		];

		const sections = groupBySection(children);
		expect(sections.map((s) => s.title)).toEqual([
			"Getting Started",
			"Components",
		]);
		expect(sections[0]?.items.map((i) => i.url)).toEqual([
			"@diffgazer/ui/getting-started",
		]);
	});

	it("drops separators that label no items so no stray header renders", () => {
		const children: PageTreeNode[] = [
			{ type: "separator", name: "Empty" },
			{ type: "separator", name: "Components" },
			{ type: "page", name: "Button", url: "@diffgazer/ui/components/button" },
			{ type: "separator", name: "Trailing" },
		];

		const sections = groupBySection(children);
		expect(sections).toHaveLength(1);
		expect(sections[0]?.title).toBe("Components");
	});
});

describe("findSectionIndexUrl", () => {
	it("returns the item whose url is the parent of its siblings", () => {
		const items = [
			page("Hooks", "@diffgazer/ui/hooks"),
			page("Active Heading", "@diffgazer/ui/hooks/active-heading"),
		];
		expect(findSectionIndexUrl(items)).toBe("@diffgazer/ui/hooks");
	});

	it("returns null when no item is a parent of another", () => {
		const items = [
			page("Button", "@diffgazer/ui/components/button"),
			page("Card", "@diffgazer/ui/components/card"),
		];
		expect(findSectionIndexUrl(items)).toBeNull();
	});
});

describe("sidebarItemLabel", () => {
	function labelFor(sectionTitle: string, items: PageTreeNode[]) {
		const indexUrl = findSectionIndexUrl(items);
		return (item: PageTreeNode) =>
			sidebarItemLabel(sectionTitle, indexUrl, item);
	}

	it("relabels the section index item whose name echoes the section header", () => {
		const items = [
			page("Hooks", "@diffgazer/ui/hooks"),
			page("Active Heading", "@diffgazer/ui/hooks/active-heading"),
		];
		const label = labelFor("Hooks", items);
		expect(label(items[0] as PageTreeNode)).toBe("Overview");
		expect(label(items[1] as PageTreeNode)).toBe("Active Heading");
	});

	it("matches the section header case-insensitively", () => {
		const items = [
			page("Web mode", "/app/web"),
			page("Onboarding", "/app/web/onboarding"),
		];
		const label = labelFor("Web Mode", items);
		expect(label(items[0] as PageTreeNode)).toBe("Overview");
	});

	it("relabels when the index name extends the section header with a suffix", () => {
		const items = [
			page("Terminal UI (beta)", "/app/tui"),
			page("Keybindings", "/app/tui/keybindings"),
		];
		const label = labelFor("Terminal UI", items);
		expect(label(items[0] as PageTreeNode)).toBe("Overview");
	});

	it("keeps a distinct index title that does not echo the section header", () => {
		const items = [
			page("Introduction", "/app/getting-started"),
			page("Installation", "/app/getting-started/installation"),
		];
		const label = labelFor("Getting Started", items);
		expect(label(items[0] as PageTreeNode)).toBe("Introduction");
		expect(label(items[1] as PageTreeNode)).toBe("Installation");
	});

	it("collapses an index title that redundantly prefixes the section header", () => {
		const items = [
			page("API Overview", "/keys/api"),
			page("Types", "/keys/api/types"),
		];
		const label = labelFor("API", items);
		expect(label(items[0] as PageTreeNode)).toBe("Overview");
	});

	it("never relabels a subpage even when its name equals the section header", () => {
		const items = [
			page("Reference", "/app/reference"),
			page("CLI reference", "/app/reference/cli"),
			page("Configuration", "/app/reference/configuration"),
		];
		const label = labelFor("Reference", items);
		// the index ("/app/reference") collapses to Overview...
		expect(label(items[0] as PageTreeNode)).toBe("Overview");
		// ...but a non-index sibling keeps its own name unconditionally
		expect(label(items[1] as PageTreeNode)).toBe("CLI reference");
	});

	it("leaves items untouched when the section has no index page", () => {
		const items = [
			page("Button", "@diffgazer/ui/components/button"),
			page("Card", "@diffgazer/ui/components/card"),
		];
		const label = labelFor("Components", items);
		expect(label(items[0] as PageTreeNode)).toBe("Button");
	});
});
