import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectContextGraph,
  ProjectContextMeta,
  ProjectContextSnapshot,
} from "@diffgazer/core/schemas/context";
import { atomicWriteFile, readJsonFile } from "../../../shared/lib/fs.js";
import { createGitService } from "../../../shared/lib/git/service.js";
import { buildFileTree, formatFileTree, MAX_TREE_NODES } from "./file-tree.js";
import { discoverWorkspacePackages, formatWorkspaceGraph } from "./workspace-discovery.js";

const MAX_CONTEXT_BYTES = 50_000;
const DEFAULT_TREE_DEPTH = 5;

export async function loadContextSnapshot(
  contextDir: string,
): Promise<ProjectContextSnapshot | null> {
  try {
    const markdownPath = path.join(contextDir, "context.md");
    const markdown = await readFile(markdownPath, "utf8");
    const graphRaw = await readFile(
      path.join(contextDir, "context.json"),
      "utf8",
    );
    const metaRaw = await readFile(
      path.join(contextDir, "context.meta.json"),
      "utf8",
    );
    const graph = JSON.parse(graphRaw) as ProjectContextGraph;
    const meta = JSON.parse(metaRaw) as ProjectContextMeta;
    return { markdown, graph, meta };
  } catch {
    return null;
  }
}

export async function buildProjectContextSnapshot(
  projectPath: string,
  options: { force?: boolean } = {},
): Promise<ProjectContextSnapshot> {
  const contextDir = path.join(projectPath, ".diffgazer");
  await mkdir(contextDir, { recursive: true });

  const gitService = createGitService({ cwd: projectPath });
  const [statusHashResult, headCommitResult] = await Promise.all([
    gitService.getStatusHash().catch(() => null),
    gitService.getHeadCommit().catch(() => ({ ok: false as const, error: { message: "unknown" } })),
  ]);
  const currentHash = statusHashResult ?? "";
  const currentHeadCommit = headCommitResult.ok ? headCommitResult.value : "";

  const cached = await loadContextSnapshot(contextDir);
  if (
    cached &&
    !options.force &&
    cached.meta.statusHash === currentHash &&
    (cached.meta.headCommit ?? "") === currentHeadCommit
  ) {
    return cached;
  }

  const packages = await discoverWorkspacePackages(projectPath);
  const workspaceSummary = formatWorkspaceGraph(packages);
  const treeCounter = { count: 0, truncated: false };
  const fileTree = await buildFileTree(projectPath, {
    depth: DEFAULT_TREE_DEPTH,
    counter: treeCounter,
  });

  const packageJson = await readJsonFile<{
    name?: string;
    description?: string;
    version?: string;
  }>(path.join(projectPath, "package.json"));

  const readmePath = path.join(projectPath, "README.md");
  const readmeRaw = await readFile(readmePath, "utf8").catch(() => "");
  const readmeLines = readmeRaw
    ? readmeRaw.split("\n").slice(0, 40).join("\n")
    : "";

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
    rawMarkdown = Buffer.from(rawMarkdown, "utf-8").subarray(0, MAX_CONTEXT_BYTES).toString("utf-8");
    rawMarkdown += "\n\n(Context truncated to fit size limit)";
  }

  const graph: ProjectContextGraph = {
    generatedAt: new Date().toISOString(),
    root: projectPath,
    packages: packages.map((pkg) => ({
      name: pkg.name,
      dir: pkg.dir,
      kind: pkg.kind,
    })),
    edges: packages.map((pkg) => ({
      from: pkg.name,
      to: pkg.dependencies.filter((dep) =>
        packages.some((p) => p.name === dep),
      ),
    })),
    fileTree,
    changedFiles: [],
  };

  const meta: ProjectContextMeta = {
    generatedAt: new Date().toISOString(),
    root: projectPath,
    statusHash: currentHash,
    headCommit: currentHeadCommit || undefined,
    charCount: rawMarkdown.length,
    ...(treeCounter.truncated ? { treeTruncated: true } : {}),
  };

  await atomicWriteFile(
    path.join(contextDir, "context.json"),
    JSON.stringify(graph, null, 2),
  );
  await atomicWriteFile(path.join(contextDir, "context.md"), rawMarkdown);
  await atomicWriteFile(
    path.join(contextDir, "context.meta.json"),
    JSON.stringify(meta, null, 2),
  );

  return { markdown: rawMarkdown, graph, meta };
}
