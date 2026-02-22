export const DOCS_LIBRARY_IDS = ["diff-ui", "keyscope", "diffgazer"] as const;

export type DocsLibraryId = (typeof DOCS_LIBRARY_IDS)[number];

export interface DocsLibraryConfig {
  id: DocsLibraryId;
  displayName: string;
  logoText: string;
  githubUrl: string;
  enabled: boolean;
  defaultRouteSlugs: string[];
}

const LIBRARY_CONFIG: Record<DocsLibraryId, DocsLibraryConfig> = {
  "diff-ui": {
    id: "diff-ui",
    displayName: "Diff UI",
    logoText: "diff-ui/docs",
    githubUrl: "https://github.com/diffgazer/diff-ui",
    enabled: true,
    defaultRouteSlugs: ["getting-started", "installation"],
  },
  keyscope: {
    id: "keyscope",
    displayName: "Keyscope",
    logoText: "keyscope/docs",
    githubUrl: "https://github.com/b4r7x/keyscope",
    enabled: true,
    defaultRouteSlugs: ["getting-started", "installation"],
  },
  diffgazer: {
    id: "diffgazer",
    displayName: "Diffgazer",
    logoText: "diffgazer/docs",
    githubUrl: "https://github.com/diffgazer",
    enabled: false,
    defaultRouteSlugs: [],
  },
};

const SOURCE_DOCS_PREFIX = "/docs/";

function normalizeRouteSlugs(slugs: string[]): string[] {
  return slugs.map((slug) => slug.trim()).filter(Boolean);
}

function splitPathname(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function isDocsLibraryId(value: string): value is DocsLibraryId {
  return DOCS_LIBRARY_IDS.some((id) => id === value);
}

export function getDocsLibraryConfig(lib: DocsLibraryId): DocsLibraryConfig {
  return LIBRARY_CONFIG[lib];
}

export function getEnabledDocsLibraries(): DocsLibraryConfig[] {
  return DOCS_LIBRARY_IDS.map((id) => LIBRARY_CONFIG[id]).filter((config) => config.enabled);
}

export function parseDocsLibrary(value: string | null | undefined): DocsLibraryId {
  if (value && isDocsLibraryId(value)) {
    return value;
  }
  return "diff-ui";
}

export function getDocsLibraryFromPathname(pathname: string): DocsLibraryId | null {
  const segments = splitPathname(pathname);
  const library = segments[0];
  if (library && segments.length >= 2 && segments[1] === "docs" && isDocsLibraryId(library)) {
    return library;
  }
  return null;
}

export function getRouteSlugsFromPathname(pathname: string, library: DocsLibraryId): string[] {
  const expectedPrefix = `/${library}/docs`;
  if (pathname === expectedPrefix) {
    return [];
  }

  if (!pathname.startsWith(`${expectedPrefix}/`)) {
    return [];
  }

  const rel = pathname.slice(expectedPrefix.length + 1);
  return normalizeRouteSlugs(rel.split("/"));
}

export function docsPath(library: DocsLibraryId, slugs?: string[] | string): string {
  const normalized = Array.isArray(slugs)
    ? normalizeRouteSlugs(slugs)
    : typeof slugs === "string"
      ? normalizeRouteSlugs(slugs.split("/"))
      : [];

  if (normalized.length === 0) {
    return `/${library}/docs`;
  }

  return `/${library}/docs/${normalized.join("/")}`;
}

export function sourceSlugsForLibrary(library: DocsLibraryId, routeSlugs: string[]): string[] {
  const normalized = normalizeRouteSlugs(routeSlugs);

  if (normalized.length === 0) {
    return [library, ...LIBRARY_CONFIG[library].defaultRouteSlugs];
  }

  return [library, ...normalized];
}

export function routeSlugsFromSourcePath(library: DocsLibraryId, sourcePath: string): string[] | null {
  if (!sourcePath.startsWith(SOURCE_DOCS_PREFIX)) {
    return null;
  }

  const rawSlugs = normalizeRouteSlugs(sourcePath.slice(SOURCE_DOCS_PREFIX.length).split("/"));
  if (rawSlugs[0] !== library) {
    return null;
  }

  const slugs = rawSlugs.slice(1);
  if (slugs.length === 1 && slugs[0] === "index") {
    return [];
  }
  return slugs;
}
