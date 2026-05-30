import type { Node as FumadocsNode, Root as FumadocsRoot } from "fumadocs-core/page-tree";
import { docsPath, getDocsLibraryConfig, routeSlugsFromSourcePath, type DocsLibraryId } from "@/lib/docs-library";

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

function normalizeSeparators(nodes: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];

  for (const node of nodes) {
    if (node.type === "separator") {
      if (result.length === 0 || result[result.length - 1]?.type === "separator") {
        continue;
      }
      result.push(node);
      continue;
    }
    result.push(node);
  }

  while (result[result.length - 1]?.type === "separator") {
    result.pop();
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
