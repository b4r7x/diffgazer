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
