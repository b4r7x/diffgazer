import path from "node:path";
import type { FileTreeNode } from "@diffgazer/core/schemas/context";
import { readFileDirectory } from "./workspace-discovery.js";

const CONTEXT_EXCLUDE_DIRS = new Set([
  ".git",
  ".diffgazer",
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

export const MAX_TREE_NODES = 1000;

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
  },
): Promise<FileTreeNode[]> {
  if (options.depth < 0) return [];

  const counter = options.counter ?? { count: 0, truncated: false };

  const rootNodes: FileTreeNode[] = [];
  const queue: PendingDir[] = [];

  // Breadth-first: expand the whole tree level by level so every top-level
  // directory is represented before any single subtree exhausts the node
  // budget (a deep dependency dir can no longer consume the cap depth-first).
  await expandDirectory(root, options.depth, root, counter, rootNodes, queue);
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
): Promise<void> {
  const entries = await readFileDirectory(dirPath);
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (counter.count >= MAX_TREE_NODES) {
      counter.truncated = true;
      break;
    }
    if (CONTEXT_EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(root, fullPath);
    counter.count += 1;
    if (entry.kind === "directory") {
      const node: FileTreeNode = { name: entry.name, path: relativePath, type: "dir" };
      out.push(node);
      if (depth > 0) {
        queue.push({ dirPath: fullPath, depth: depth - 1, node });
      }
    } else {
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
