import {
  docsLibrariesConfig,
  type ArtifactSourceConfig,
  type DocsLibraryConfigData,
} from "./docs-libraries-config";

const KNOWN_LIBRARY_IDS = ["ui", "keys", "diffgazer"] as const;
export type DocsLibraryId = (typeof KNOWN_LIBRARY_IDS)[number];
export type ArtifactSource = ArtifactSourceConfig;
export type DocsLibraryConfig = DocsLibraryConfigData;

export const DOCS_LIBRARY_IDS: readonly DocsLibraryId[] = KNOWN_LIBRARY_IDS;
export const PRIMARY_DOCS_LIBRARY_ID = docsLibrariesConfig.primaryLibraryId as DocsLibraryId;

const LIBRARY_CONFIG = Object.fromEntries(
  docsLibrariesConfig.libraries.map((library) => [library.id, library]),
) as Record<string, DocsLibraryConfig>;

export const SOURCE_DOCS_PREFIX = "/docs/";

function normalizeRouteSlugs(slugs: string[]): string[] {
  return slugs.map((slug) => slug.trim()).filter(Boolean);
}

function splitPathname(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function isDocsLibraryId(value: string): value is DocsLibraryId {
  return (KNOWN_LIBRARY_IDS as readonly string[]).includes(value);
}

export function getDocsLibraryConfig(lib: DocsLibraryId): DocsLibraryConfig {
  const config = LIBRARY_CONFIG[lib];
  if (!config) {
    throw new Error(`Unknown docs library: "${lib}"`);
  }
  return config;
}

export function getEnabledDocsLibraries(): DocsLibraryConfig[] {
  return docsLibrariesConfig.libraries.filter((config) => config.enabled);
}

function prefixInstallItem(itemName: string, itemPrefix?: string): string {
  const normalized = itemName.trim();
  if (!itemPrefix || normalized.includes("/")) {
    return normalized;
  }
  return `${itemPrefix}${normalized}`;
}

export function getInstallCommand(library: DocsLibraryId, itemName: string): string | null {
  const installer = getDocsLibraryConfig(library).installer;
  if (!installer) return null;

  const item = prefixInstallItem(itemName, installer.itemPrefix);
  return `${installer.command} ${item}`;
}

export function getLibrariesWithArtifacts(): (DocsLibraryConfig & { artifactSource: ArtifactSource })[] {
  return getEnabledDocsLibraries().filter(
    (c): c is DocsLibraryConfig & { artifactSource: ArtifactSource } => !!c.artifactSource,
  );
}

export function parseDocsLibrary(value: string | null | undefined): DocsLibraryId {
  if (value && isDocsLibraryId(value)) {
    return value;
  }
  if (isDocsLibraryId(PRIMARY_DOCS_LIBRARY_ID)) {
    return PRIMARY_DOCS_LIBRARY_ID;
  }
  return DOCS_LIBRARY_IDS[0] ?? PRIMARY_DOCS_LIBRARY_ID;
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

export function isDocsPath(pathname?: string | null): boolean {
  if (!pathname) return false;
  return /^\/[^/]+\/docs(?:\/|$)/.test(pathname);
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
