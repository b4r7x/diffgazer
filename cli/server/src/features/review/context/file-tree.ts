import { realpath } from "node:fs/promises";
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
]);

export const MAX_TREE_NODES = 1000;

export async function buildFileTree(
  root: string,
  options: {
    depth: number;
    baseRoot?: string;
    visited?: Set<string>;
    counter?: { count: number; truncated: boolean };
  },
): Promise<FileTreeNode[]> {
  const { depth } = options;
  if (depth < 0) return [];

  const baseRoot = options.baseRoot ?? root;
  const visited = options.visited ?? new Set<string>();
  const counter = options.counter ?? { count: 0, truncated: false };

  // Prevent symlink cycles by tracking visited real paths
  const real = await realpath(root).catch(() => root);
  if (visited.has(real)) return [];
  visited.add(real);

  const entries = await readFileDirectory(root);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (counter.count >= MAX_TREE_NODES) {
      counter.truncated = true;
      break;
    }
    if (CONTEXT_EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    const relativePath = path.relative(baseRoot, fullPath);
    counter.count += 1;
    if (entry.isDirectory) {
      const children =
        depth > 0
          ? await buildFileTree(fullPath, { depth: depth - 1, baseRoot, visited, counter })
          : undefined;
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "dir",
        children,
      });
    } else {
      nodes.push({ name: entry.name, path: relativePath, type: "file" });
    }
  }

  return nodes;
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
