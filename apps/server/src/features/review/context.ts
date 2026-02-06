import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { FileTreeNode, ProjectContextGraph, ProjectContextMeta, ProjectContextSnapshot } from "@stargazer/schemas/context";
import { readJsonFile } from "../../shared/lib/fs.js";
import { now } from "../../shared/lib/review/utils.js";
import { createGitService } from "../../shared/lib/git/service.js";

type WorkspacePackage = {
  name: string;
  dir: string;
  kind: "app" | "package";
  dependencies: string[];
};

async function readFileDirectory(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return [];
  }
}

async function discoverWorkspacePackages(projectPath: string): Promise<WorkspacePackage[]> {
  const roots: Array<{ dir: string; kind: WorkspacePackage["kind"] }> = [
    { dir: "apps", kind: "app" },
    { dir: "packages", kind: "package" },
  ];

  const packages: WorkspacePackage[] = [];

  for (const root of roots) {
    const absoluteRoot = path.join(projectPath, root.dir);
    if (!existsSync(absoluteRoot)) continue;

    const entries = await readFileDirectory(absoluteRoot);
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      const pkgJsonPath = path.join(absoluteRoot, entry.name, "package.json");
      const pkgJson = await readJsonFile<{ name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }>(pkgJsonPath);
      if (!pkgJson?.name) continue;
      const dependencies = new Set<string>();
      Object.keys(pkgJson.dependencies ?? {}).forEach((dep) => dependencies.add(dep));
      Object.keys(pkgJson.devDependencies ?? {}).forEach((dep) => dependencies.add(dep));
      Object.keys(pkgJson.peerDependencies ?? {}).forEach((dep) => dependencies.add(dep));

      packages.push({
        name: pkgJson.name,
        dir: path.join(root.dir, entry.name),
        kind: root.kind,
        dependencies: Array.from(dependencies),
      });
    }
  }

  return packages;
}

function formatWorkspaceGraph(packages: WorkspacePackage[]): string {
  if (packages.length === 0) {
    return "No workspace packages detected.";
  }

  const nameToPkg = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const edges = packages.map((pkg) => ({
    from: pkg.name,
    to: pkg.dependencies.filter((dep) => nameToPkg.has(dep)),
  }));

  const lines: string[] = [];
  lines.push(`Workspace packages: ${packages.length}`);
  lines.push("");
  lines.push("Packages:");
  for (const pkg of packages) {
    lines.push(`- ${pkg.name} (${pkg.kind}, ${pkg.dir})`);
  }

  lines.push("");
  lines.push("Dependency graph (internal only):");
  for (const edge of edges) {
    if (edge.to.length === 0) {
      lines.push(`- ${edge.from} -> (none)`);
    } else {
      lines.push(`- ${edge.from} -> ${edge.to.join(", ")}`);
    }
  }

  return lines.join("\n");
}

const CONTEXT_EXCLUDE_DIRS = new Set([
  ".git",
  ".stargazer",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "out",
  ".turbo",
]);

export type { ProjectContextSnapshot };

async function buildFileTree(root: string, depth: number, baseRoot: string = root): Promise<FileTreeNode[]> {
  if (depth < 0) return [];
  const entries = await readFileDirectory(root);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (CONTEXT_EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    const relativePath = path.relative(baseRoot, fullPath);
    if (entry.isDirectory) {
      const children = depth > 0 ? await buildFileTree(fullPath, depth - 1, baseRoot) : undefined;
      nodes.push({ name: entry.name, path: relativePath, type: "dir", children });
    } else {
      nodes.push({ name: entry.name, path: relativePath, type: "file" });
    }
  }

  return nodes;
}

function formatFileTree(nodes: FileTreeNode[], indent = 0): string[] {
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

export async function loadContextSnapshot(contextDir: string): Promise<ProjectContextSnapshot | null> {
  try {
    const markdownPath = path.join(contextDir, "context.md");
    const markdown = await readFile(markdownPath, "utf8");
    const graphRaw = await readFile(path.join(contextDir, "context.json"), "utf8");
    const metaRaw = await readFile(path.join(contextDir, "context.meta.json"), "utf8");
    const graph = JSON.parse(graphRaw) as ProjectContextGraph;
    const meta = JSON.parse(metaRaw) as ProjectContextMeta;
    return { markdown, graph, meta };
  } catch {
    return null;
  }
}

const DEFAULT_TREE_DEPTH = 5;

export async function buildProjectContextSnapshot(
  projectPath: string,
  options: { force?: boolean } = {}
): Promise<ProjectContextSnapshot> {
  const contextDir = path.join(projectPath, ".stargazer");
  await mkdir(contextDir, { recursive: true });

  const gitService = createGitService({ cwd: projectPath });
  const currentHash = await gitService.getStatusHash().catch(() => "");

  const cached = await loadContextSnapshot(contextDir);
  if (cached && !options.force && cached.meta.statusHash === currentHash) {
    return cached;
  }

  const packages = await discoverWorkspacePackages(projectPath);
  const workspaceSummary = formatWorkspaceGraph(packages);
  const fileTree = await buildFileTree(projectPath, DEFAULT_TREE_DEPTH);

  const packageJson = await readJsonFile<{
    name?: string;
    description?: string;
    version?: string;
  }>(path.join(projectPath, "package.json"));

  const readmePath = path.join(projectPath, "README.md");
  const readmeRaw = await readFile(readmePath, "utf8").catch(() => "");
  const readmeLines = readmeRaw ? readmeRaw.split("\n").slice(0, 40).join("\n") : "";

  const markdownSections: string[] = [];
  markdownSections.push(`# Project Context Snapshot`);
  markdownSections.push(`Generated: ${now()}`);
  markdownSections.push(`Root: ${projectPath}`);
  markdownSections.push("");
  markdownSections.push("## Project Info");
  if (packageJson) {
    markdownSections.push(`- Name: ${packageJson.name ?? "Unknown"}`);
    markdownSections.push(`- Version: ${packageJson.version ?? "Unknown"}`);
    if (packageJson.description) {
      markdownSections.push(`- Description: ${packageJson.description}`);
    }
  } else {
    markdownSections.push("package.json not found.");
  }
  if (readmeLines) {
    markdownSections.push("");
    markdownSections.push("## README (excerpt)");
    markdownSections.push("```");
    markdownSections.push(readmeLines);
    markdownSections.push("```");
  }
  markdownSections.push("");
  markdownSections.push("## Workspace Summary");
  markdownSections.push(workspaceSummary || "No workspace packages detected.");
  markdownSections.push("");
  markdownSections.push("## File Tree");
  markdownSections.push(...formatFileTree(fileTree));

  const rawMarkdown = markdownSections.join("\n");

  const graph: ProjectContextGraph = {
    generatedAt: now(),
    root: projectPath,
    packages: packages.map((pkg) => ({
      name: pkg.name,
      dir: pkg.dir,
      kind: pkg.kind,
    })),
    edges: packages.map((pkg) => ({
      from: pkg.name,
      to: pkg.dependencies.filter((dep) => packages.some((p) => p.name === dep)),
    })),
    fileTree,
    changedFiles: [],
  };

  const meta: ProjectContextMeta = {
    generatedAt: now(),
    root: projectPath,
    statusHash: currentHash,
    charCount: rawMarkdown.length,
  };

  await writeFile(path.join(contextDir, "context.json"), JSON.stringify(graph, null, 2), "utf8");
  await writeFile(path.join(contextDir, "context.md"), rawMarkdown, "utf8");
  await writeFile(path.join(contextDir, "context.meta.json"), JSON.stringify(meta, null, 2), "utf8");

  return { markdown: rawMarkdown, graph, meta };
}
