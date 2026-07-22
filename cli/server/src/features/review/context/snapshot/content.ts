import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectContextGraph,
  ProjectContextMeta,
  ProjectContextSnapshot,
} from "@diffgazer/core/schemas/context";
import {
  ProjectContextGraphSchema,
  ProjectContextMetaSchema,
} from "@diffgazer/core/schemas/context";
import { buildFileTree, formatFileTree, MAX_TREE_NODES } from "../file-tree.js";
import { discoverWorkspacePackages, type WorkspacePackage } from "../workspace/discovery.js";
import { formatWorkspaceGraph } from "../workspace/format.js";
import { readPackageManifest } from "../workspace/manifest.js";
import { resolvesWithinRoot } from "./artifacts.js";

const MAX_CONTEXT_BYTES = 50_000;
const DEFAULT_TREE_DEPTH = 5;

function truncateToByteLimit(text: string, maxBytes: number): string {
  const buffer = Buffer.from(text, "utf-8");
  if (buffer.byteLength <= maxBytes) return text;

  let end = maxBytes;
  while (end > 0 && ((buffer[end] ?? 0) & 0xc0) === 0x80) {
    end -= 1;
  }

  const newlineIndex = buffer.lastIndexOf(0x0a, end - 1);
  if (newlineIndex > 0) {
    end = newlineIndex;
  }

  return buffer.subarray(0, end).toString("utf-8");
}

export function buildWorkspaceEdges(
  packages: readonly WorkspacePackage[],
): ProjectContextGraph["edges"] {
  const packageNames = new Set(packages.map((pkg) => pkg.name));
  return packages.map((pkg) => ({
    from: pkg.name,
    to: pkg.dependencies.filter((dependency) => packageNames.has(dependency)),
  }));
}

export type BuildSnapshotContentInput = {
  projectPath: string;
  normalizedRoot: string;
  statusHash: string;
  statusHashKind: ProjectContextMeta["statusHashKind"];
  headCommit: string;
};

export async function buildSnapshotContent(
  input: BuildSnapshotContentInput,
): Promise<ProjectContextSnapshot> {
  const { projectPath, normalizedRoot, statusHash, statusHashKind, headCommit } = input;

  const packages = await discoverWorkspacePackages(projectPath);
  const workspaceSummary = formatWorkspaceGraph(packages);
  const treeCounter = { count: 0, truncated: false };
  const fileTree = await buildFileTree(projectPath, {
    depth: DEFAULT_TREE_DEPTH,
    counter: treeCounter,
  });

  const packageJsonPath = path.join(projectPath, "package.json");
  const packageJson = (await resolvesWithinRoot(packageJsonPath, normalizedRoot))
    ? await readPackageManifest(packageJsonPath)
    : null;

  const readmePath = path.join(projectPath, "README.md");
  const readmeRaw = (await resolvesWithinRoot(readmePath, normalizedRoot))
    ? await readFile(readmePath, "utf8").catch(() => "")
    : "";
  const readmeLines = readmeRaw ? readmeRaw.split("\n").slice(0, 40).join("\n") : "";

  const markdownSections: string[] = [];
  markdownSections.push(`# Project Context Snapshot`);
  markdownSections.push(`Generated: ${new Date().toISOString()}`);
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
  if (treeCounter.truncated) {
    markdownSections.push(`\n(File tree truncated at ${MAX_TREE_NODES} nodes)`);
  }

  let rawMarkdown = markdownSections.join("\n");
  if (Buffer.byteLength(rawMarkdown, "utf-8") > MAX_CONTEXT_BYTES) {
    rawMarkdown = truncateToByteLimit(rawMarkdown, MAX_CONTEXT_BYTES);
    rawMarkdown += "\n\n(Context truncated to fit size limit)";
  }

  const graphResult = ProjectContextGraphSchema.safeParse({
    generatedAt: new Date().toISOString(),
    root: projectPath,
    packages: packages.map((pkg) => ({
      name: pkg.name,
      dir: pkg.dir,
      kind: pkg.kind,
    })),
    edges: buildWorkspaceEdges(packages),
    fileTree,
    changedFiles: [],
  });
  if (!graphResult.success) {
    throw new Error(`Failed to build context graph: ${graphResult.error.message}`);
  }
  const graph: ProjectContextGraph = graphResult.data;

  const metaResult = ProjectContextMetaSchema.safeParse({
    generatedAt: new Date().toISOString(),
    root: projectPath,
    statusHash,
    statusHashKind,
    headCommit: headCommit || undefined,
    charCount: rawMarkdown.length,
    ...(treeCounter.truncated ? { treeTruncated: true } : {}),
  });
  if (!metaResult.success) {
    throw new Error(`Failed to build context metadata: ${metaResult.error.message}`);
  }
  const meta: ProjectContextMeta = metaResult.data;

  return { markdown: rawMarkdown, graph, meta };
}
