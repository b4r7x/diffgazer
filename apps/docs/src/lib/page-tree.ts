import type { Node as FumadocsNode, Root as FumadocsRoot } from "fumadocs-core/page-tree";
import {
  type DocsLibraryId,
  docsPath,
  getDocsLibraryConfig,
  routeSlugsFromSourcePath,
} from "@/lib/library";

export interface PageTreeNode {
  type: "page" | "separator" | "folder";
  name: string;
  url?: string;
  children?: PageTreeNode[];
}

export interface PageTree {
  name: string;
  children: PageTreeNode[];
}

export interface LandingItem {
  name: string;
  url: string;
}

export interface LandingSection {
  name: string;
  items: LandingItem[];
}

function toLandingItem(node: PageTreeNode): LandingItem | null {
  if (node.type === "page" && node.url) {
    return { name: node.name, url: node.url };
  }
  return null;
}

/** Depth-first list of navigable pages in sidebar order, skipping separators and url-less folders. */
function flattenPageTree(tree: PageTree): LandingItem[] {
  const pages: LandingItem[] = [];
  const walk = (nodes: PageTreeNode[]) => {
    for (const node of nodes) {
      const item = toLandingItem(node);
      if (item) pages.push(item);
      if (node.children) walk(node.children);
    }
  };
  walk(tree.children);
  return pages;
}

/**
 * The first navigable page in sidebar order, i.e. the page the sidebar renders
 * at the top once separators and url-less folders are skipped. The bare library
 * root redirects here so visitors never land on an empty library shell.
 */
export function firstNavigablePage(tree: PageTree): LandingItem | null {
  return flattenPageTree(tree)[0] ?? null;
}

export interface PageNeighbors {
  previous: LandingItem | null;
  next: LandingItem | null;
}

export function findPageNeighbors(tree: PageTree, url: string): PageNeighbors {
  const pages = flattenPageTree(tree);
  const index = pages.findIndex((page) => page.url === url);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: pages[index - 1] ?? null,
    next: pages[index + 1] ?? null,
  };
}

/**
 * Names of the sections a page belongs to in sidebar taxonomy order: the last
 * separator seen at each level plus any enclosing folder names. This is the
 * tree's grouping (what the sidebar shows), which can diverge from the URL —
 * e.g. /ui/changelog sits under the "Project" separator.
 */
export function findTreeSectionPath(tree: PageTree, url: string): string[] {
  const walk = (nodes: PageTreeNode[], ancestors: string[]): string[] | null => {
    let lastSeparator: string | null = null;
    for (const node of nodes) {
      if (node.type === "separator") {
        lastSeparator = node.name;
        continue;
      }
      const chain = lastSeparator ? [...ancestors, lastSeparator] : ancestors;
      if (node.type === "page" && node.url === url) {
        return chain;
      }
      if (node.children) {
        const found = walk(node.children, node.type === "folder" ? [...chain, node.name] : chain);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(tree.children, []) ?? [];
}

/**
 * Groups a mapped page tree into separator-delimited sections. Leading pages
 * before the first separator fall back to a section named after the tree, and
 * empty sections are dropped.
 */
export function collectLandingSections(tree: PageTree): LandingSection[] {
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

/**
 * fumadocs page-tree node names are typed as `ReactNode`. Ours are plain
 * strings (they come from MDX titles / meta.json), so coerce defensively at
 * the boundary instead of casting the whole tree.
 */
function nodeName(name: unknown): string {
  return typeof name === "string" ? name : "";
}

function fromFumadocsNode(node: FumadocsNode): PageTreeNode {
  if (node.type === "folder") {
    // fumadocs folders carry no top-level url (only an optional `index` page);
    // the local tree treats folders as url-less groups.
    return {
      type: "folder",
      name: nodeName(node.name),
      children: node.children.map(fromFumadocsNode),
    };
  }
  if (node.type === "separator") {
    return { type: "separator", name: nodeName(node.name) };
  }
  return { type: "page", name: nodeName(node.name), url: node.url };
}

/** Adapt the fumadocs `Root` (ReactNode names) into the local string-typed `PageTree`. */
export function fromFumadocsRoot(root: FumadocsRoot): PageTree {
  return {
    name: nodeName(root.name),
    children: root.children.map(fromFumadocsNode),
  };
}

/**
 * A separator labels the section that follows it up to the next separator.
 * Library scoping filters out the other libraries' pages but keeps their
 * separators, leaving empty and consecutive separators (including a now-leading
 * one in front of the active library's first real section). Drop separators that
 * label no following content and, in a consecutive run, keep only the last so
 * the surviving label belongs to the pages that follow it.
 */
function normalizeSeparators(nodes: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];
  let pendingSeparator: PageTreeNode | null = null;

  for (const node of nodes) {
    if (node.type === "separator") {
      pendingSeparator = node;
      continue;
    }
    if (pendingSeparator) {
      result.push(pendingSeparator);
      pendingSeparator = null;
    }
    result.push(node);
  }

  return result;
}

function mapNodeForLibrary(node: PageTreeNode, library: DocsLibraryId): PageTreeNode | null {
  if (node.type === "separator") {
    return { ...node };
  }

  if (node.type === "page") {
    if (!node.url) return null;

    const routeSlugs = routeSlugsFromSourcePath(library, node.url);
    if (!routeSlugs) return null;

    return {
      ...node,
      url: docsPath(library, routeSlugs),
    };
  }

  const mappedChildren = normalizeSeparators(
    (node.children ?? [])
      .map((child) => mapNodeForLibrary(child, library))
      .filter((child): child is PageTreeNode => Boolean(child)),
  );

  if (mappedChildren.length === 0) {
    return null;
  }

  const routeSlugs = node.url ? routeSlugsFromSourcePath(library, node.url) : null;

  return {
    ...node,
    url: routeSlugs ? docsPath(library, routeSlugs) : undefined,
    children: mappedChildren,
  };
}

export function mapPageTreeForLibrary(inputTree: PageTree, library: DocsLibraryId): PageTree {
  const mappedChildren = normalizeSeparators(
    inputTree.children
      .map((child) => mapNodeForLibrary(child, library))
      .filter((child): child is PageTreeNode => Boolean(child)),
  );

  let children = mappedChildren;
  if (mappedChildren.length === 1 && mappedChildren[0]?.type === "folder") {
    children = normalizeSeparators(mappedChildren[0].children ?? []);
  }

  return {
    name: getDocsLibraryConfig(library).displayName,
    children,
  };
}
