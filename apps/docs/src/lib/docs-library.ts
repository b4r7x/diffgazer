import librarySources from "@/generated/library-sources.json"

export type DocsLibraryId = "diff-ui" | "keyscope"

export interface DocsLibrary {
  id: DocsLibraryId
  name: string
  logoText: string
  githubUrl: string
  defaultDocPath: string
  sidebarRoot: string
  version: string
}

type LibrarySource = {
  id: string
  version?: string
}

const versionsById = new Map(
  (librarySources as LibrarySource[]).map((entry) => [entry.id, entry.version ?? "0.0.0"]),
)

const docsLibraries: Record<DocsLibraryId, Omit<DocsLibrary, "version">> = {
  "diff-ui": {
    id: "diff-ui",
    name: "diffui",
    logoText: "diffui",
    githubUrl: "https://github.com/diffgazer/diff-ui",
    defaultDocPath: "getting-started/installation",
    sidebarRoot: "~/diff-ui/docs",
  },
  keyscope: {
    id: "keyscope",
    name: "keyscope",
    logoText: "keyscope",
    githubUrl: "https://github.com/b4r7x/keyscope",
    defaultDocPath: "keyscope/api",
    sidebarRoot: "~/keyscope/docs",
  },
}

export const docsLibraryIds: DocsLibraryId[] = ["diff-ui", "keyscope"]

export function inferDocsLibraryFromPath(pathname: string): DocsLibraryId {
  return pathname.startsWith("/docs/keyscope") ? "keyscope" : "diff-ui"
}

export function getDocsLibrary(id: DocsLibraryId): DocsLibrary {
  return {
    ...docsLibraries[id],
    version: versionsById.get(id) ?? "0.0.0",
  }
}
