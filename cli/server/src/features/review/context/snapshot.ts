import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectContextGraph,
  ProjectContextMeta,
  ProjectContextSnapshot,
} from "@diffgazer/core/schemas/context";
import {
  ProjectContextGraphSchema,
  ProjectContextMetaSchema,
  ProjectContextSnapshotSchema,
} from "@diffgazer/core/schemas/context";
import { atomicWriteFile } from "../../../shared/lib/fs.js";
import { createGitService } from "../../../shared/lib/git/service.js";
import { log } from "../../../shared/lib/log.js";
import { buildFileTree, formatFileTree, MAX_TREE_NODES } from "./file-tree.js";
import {
  discoverWorkspacePackages,
  formatWorkspaceGraph,
  readPackageManifest,
} from "./workspace-discovery.js";

const MAX_CONTEXT_BYTES = 50_000;
const DEFAULT_TREE_DEPTH = 5;

// Truncate `text` so its UTF-8 encoding fits within `maxBytes`, cutting on a
// newline boundary when one exists in range and otherwise on a code-point
// boundary — never mid-character (which would append a U+FFFD replacement).
function truncateToByteLimit(text: string, maxBytes: number): string {
  const buffer = Buffer.from(text, "utf-8");
  if (buffer.byteLength <= maxBytes) return text;

  // Back off to the start of the truncated code point: continuation bytes
  // are 0b10xxxxxx (0x80–0xBF).
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

export async function loadContextSnapshot(
  contextDir: string,
): Promise<ProjectContextSnapshot | null> {
  try {
    const markdownPath = path.join(contextDir, "context.md");
    const markdown = await readFile(markdownPath, "utf8");
    const graphRaw = await readFile(path.join(contextDir, "context.json"), "utf8");
    const metaRaw = await readFile(path.join(contextDir, "context.meta.json"), "utf8");
    const parsed = ProjectContextSnapshotSchema.safeParse({
      markdown,
      graph: JSON.parse(graphRaw),
      meta: JSON.parse(metaRaw),
    });
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => {
          const issuePath = issue.path.length > 0 ? issue.path.join(".") : "<root>";
          return `${issuePath}: ${issue.message}`;
        })
        .join("; ");
      log("warn", "context_snapshot_invalid", { contextDir, issues });
      return null;
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof Error) {
      log("warn", "context_snapshot_unreadable", { contextDir, error: error.message });
    }
    return null;
  }
}

const snapshotLocks = new Map<string, Promise<unknown>>();

// Serialize builds per project root so POST /context/refresh and the review
// pipeline's own build cannot interleave their sequential writes and persist a
// mixed-generation trio (markdown from one build, meta/statusHash from another).
function withSnapshotLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  const prev = snapshotLocks.get(projectPath) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  snapshotLocks.set(projectPath, next);
  next.then(
    () => {
      if (snapshotLocks.get(projectPath) === next) snapshotLocks.delete(projectPath);
    },
    () => {
      if (snapshotLocks.get(projectPath) === next) snapshotLocks.delete(projectPath);
    },
  );
  return next;
}

export function buildProjectContextSnapshot(
  projectPath: string,
  options: { force?: boolean } = {},
): Promise<ProjectContextSnapshot> {
  return withSnapshotLock(projectPath, () => buildSnapshot(projectPath, options));
}

async function buildSnapshot(
  projectPath: string,
  options: { force?: boolean },
): Promise<ProjectContextSnapshot> {
  const contextDir = path.join(projectPath, ".diffgazer");
  await mkdir(contextDir, { recursive: true, mode: 0o700 });

  const gitService = createGitService({ cwd: projectPath });
  const [statusHashResult, headCommitResult] = await Promise.all([
    gitService.getStatusHash().catch(() => ({ kind: "unavailable" as const })),
    gitService.getHeadCommit().catch(() => ({ ok: false as const, error: { message: "unknown" } })),
  ]);
  const currentHash = statusHashResult.kind === "unavailable" ? "" : statusHashResult.hash;
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

  const packageJson = await readPackageManifest(path.join(projectPath, "package.json"));

  const readmePath = path.join(projectPath, "README.md");
  const readmeRaw = await readFile(readmePath, "utf8").catch(() => "");
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
    edges: packages.map((pkg) => ({
      from: pkg.name,
      to: pkg.dependencies.filter((dep) => packages.some((p) => p.name === dep)),
    })),
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
    statusHash: currentHash,
    headCommit: currentHeadCommit || undefined,
    charCount: rawMarkdown.length,
    ...(treeCounter.truncated ? { treeTruncated: true } : {}),
  });
  if (!metaResult.success) {
    throw new Error(`Failed to build context metadata: ${metaResult.error.message}`);
  }
  const meta: ProjectContextMeta = metaResult.data;

  await atomicWriteFile(path.join(contextDir, "context.json"), JSON.stringify(graph, null, 2));
  await atomicWriteFile(path.join(contextDir, "context.md"), rawMarkdown);
  await atomicWriteFile(path.join(contextDir, "context.meta.json"), JSON.stringify(meta, null, 2));

  return { markdown: rawMarkdown, graph, meta };
}
