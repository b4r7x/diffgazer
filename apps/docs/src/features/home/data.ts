import type { DocsLibraryConfigData } from "@/lib/libraries-config";
import type { DocsLibraryId } from "@/lib/library";
import type { LandingSection } from "@/lib/page-tree";

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
  const byName = new Map(sections.map((section) => [section.name.toLowerCase(), section]));
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

/** App docs use product-area separators (Product, Concepts, CLI, …), not ui/keys buckets. */
function pickAllSections(sections: LandingSection[]): HomeSectionLink[] {
  const links: HomeSectionLink[] = [];
  for (const section of sections) {
    const link = toSectionLink(section);
    if (link) links.push(link);
  }
  return links;
}

export function buildHomeLibrary(
  config: DocsLibraryConfigData,
  library: DocsLibraryId,
  sections: LandingSection[],
): HomeLibrary {
  const sectionLinks = library === "app" ? pickAllSections(sections) : pickMainSections(sections);

  return {
    id: library,
    displayName: config.displayName,
    sections: sectionLinks,
  };
}
