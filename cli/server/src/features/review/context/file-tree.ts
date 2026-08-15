import path from "node:path";
import type { FileTreeNode } from "@diffgazer/core/schemas/context";
import { MAX_CONTEXT_TREE_NODES } from "@diffgazer/core/schemas/context";
import { readFileDirectory } from "./directory.js";

const CONTEXT_EXCLUDE_DIRS = new Set([
  ".git",
  ".diffgazer",
  ".nuke",
  ".audit-runs",
  ".cache",
  ".cursor",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "out",
  ".turbo",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "target",
  "vendor",
  ".gradle",
  ".idea",
  "Pods",
  "DerivedData",
]);

function normalizeFocusPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function focusPathSet(focusPaths: readonly string[] | undefined): Set<string> | null {
  if (!focusPaths || focusPaths.length === 0) return null;
  const paths = new Set<string>();
  for (const rawPath of focusPaths) {
    const filePath = normalizeFocusPath(rawPath);
    if (!filePath) continue;
    const segments = filePath.split("/");
    for (let depth = 0; depth < segments.length; depth += 1) {
      paths.add(segments.slice(0, depth + 1).join("/"));
    }
  }
  return paths;
}

function directoryIsInFocusScope(dirPath: string, focus: Set<string> | null): boolean {
  if (!focus) return true;
  const relative = dirPath.replace(/\\/g, "/");
  if (focus.has(relative)) return true;
  for (const focused of focus) {
    if (focused.startsWith(`${relative}/`)) return true;
  }
  return false;
}

function fileIsInFocusScope(relativePath: string, focus: Set<string> | null): boolean {
  return focus === null || focus.has(relativePath.replace(/\\/g, "/"));
}

interface PendingDir {
  dirPath: string;
  depth: number;
  node: FileTreeNode;
}

export async function buildFileTree(
  root: string,
  options: {
    depth: number;
    counter?: { count: number; truncated: boolean };
    focusPaths?: readonly string[];
  },
): Promise<FileTreeNode[]> {
  if (options.depth < 0) return [];

  const counter = options.counter ?? { count: 0, truncated: false };
  const focus = focusPathSet(options.focusPaths);

  const rootNodes: FileTreeNode[] = [];
  const queue: PendingDir[] = [];

  // Breadth-first: expand the whole tree level by level so every top-level
  // directory is represented before any single subtree exhausts the node
  // budget (a deep dependency dir can no longer consume the cap depth-first).
  await expandDirectory(root, options.depth, root, counter, rootNodes, queue, focus);
  while (queue.length > 0) {
    const pending = queue.shift();
    if (!pending) break;
    pending.node.children = [];
    await expandDirectory(
      pending.dirPath,
      pending.depth,
      root,
      counter,
      pending.node.children,
      queue,
      focus,
    );
  }

  return rootNodes;
}

async function expandDirectory(
  dirPath: string,
  depth: number,
  root: string,
  counter: { count: number; truncated: boolean },
  out: FileTreeNode[],
  queue: PendingDir[],
  focus: Set<string> | null,
): Promise<void> {
  const entries = await readFileDirectory(dirPath);
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (counter.count >= MAX_CONTEXT_TREE_NODES) {
      counter.truncated = true;
      break;
    }
    // Name-based exclusion is a directory rule: a regular file named `build`,
    // `out` or `target` is real source and must stay in the tree.
    if (entry.kind !== "file" && CONTEXT_EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(root, fullPath);
    if (entry.kind === "directory") {
      if (!directoryIsInFocusScope(relativePath, focus)) continue;
      counter.count += 1;
      const node: FileTreeNode = { name: entry.name, path: relativePath, type: "dir" };
      out.push(node);
      if (depth > 0) {
        queue.push({ dirPath: fullPath, depth: depth - 1, node });
      }
    } else {
      if (!fileIsInFocusScope(relativePath, focus)) continue;
      counter.count += 1;
      out.push({ name: entry.name, path: relativePath, type: "file" });
    }
  }
}

export function formatFileTree(nodes: FileTreeNode[], indent = 0): string[] {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);
  for (const node of nodes) {
    lines.push(`${prefix}- ${node.name}${node.type === "dir" ? "/" : ""}`);
    if (node.children && node.children.length > 0) {
      lines.push(...formatFileTree(node.children, indent + 1));
    }
  }
  return lines;
}
