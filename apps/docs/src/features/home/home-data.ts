import type { DocsLibraryConfigData } from "@/lib/docs-libraries-config";
import type { DocsLibraryId } from "@/lib/docs-library";
import type { LandingSection } from "@/lib/docs-tree";

export interface HomeLibrary {
	id: DocsLibraryId;
	displayName: string;
	sections: HomeSectionLink[];
}

export interface HomeSectionLink {
	name: string;
	splat: string;
	count: number;
}

// One navigable row in the Browse table: a single library section flattened with
// its parent library so the row can deep-link to /$lib/$ and show a real count.
export interface HomeBrowseRow {
	lib: DocsLibraryId;
	libraryName: string;
	name: string;
	splat: string;
	count: number;
}

export function toBrowseRows(libraries: HomeLibrary[]): HomeBrowseRow[] {
	return libraries.flatMap((library) =>
		library.sections.map((section) => ({
			lib: library.id,
			libraryName: library.displayName,
			name: section.name,
			splat: section.splat,
			count: section.count,
		})),
	);
}

// Sections worth surfacing on the entry card, in display priority. The grouped
// tree may not contain all of them, so this is an intersection, capped at six.
const MAIN_SECTION_NAMES = [
	"Getting Started",
	"Components",
	"Hooks",
	"API",
	"Theme",
	"Patterns",
	"Guides",
];

const MAX_SECTION_LINKS = 6;

function splatFromUrl(url: string): string {
	return url.replace(/^\//, "").split("/").slice(1).join("/");
}

function toSectionLink(section: LandingSection): HomeSectionLink | null {
	const entry = section.items[0];
	if (!entry) return null;
	return {
		name: section.name,
		splat: splatFromUrl(entry.url),
		count: section.items.length,
	};
}

function pickMainSections(sections: LandingSection[]): HomeSectionLink[] {
	const byName = new Map(
		sections.map((section) => [section.name.toLowerCase(), section]),
	);
	const links: HomeSectionLink[] = [];
	for (const name of MAIN_SECTION_NAMES) {
		const section = byName.get(name.toLowerCase());
		if (!section) continue;
		const link = toSectionLink(section);
		if (link) links.push(link);
		if (links.length === MAX_SECTION_LINKS) break;
	}
	return links;
}

export function buildHomeLibrary(
	config: DocsLibraryConfigData,
	library: DocsLibraryId,
	sections: LandingSection[],
): HomeLibrary {
	return {
		id: library,
		displayName: config.displayName,
		sections: pickMainSections(sections),
	};
}
