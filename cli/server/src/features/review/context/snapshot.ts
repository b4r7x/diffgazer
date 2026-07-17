import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectContextGraph,
  ProjectContextMeta,
  ProjectContextSnapshot,
} from "@diffgazer/core/schemas/context";
import {
  ProjectContextGraphSchema,
  ProjectContextMetaSchema,
  ProjectContextSnapshotManifestSchema,
  ProjectContextSnapshotSchema,
} from "@diffgazer/core/schemas/context";
import { atomicWriteFile } from "../../../shared/lib/fs.js";
import { createGitService } from "../../../shared/lib/git/service.js";
import { log } from "../../../shared/lib/log.js";
import { createKeyedLock } from "../storage/keyed-lock.js";
import { buildFileTree, formatFileTree, MAX_TREE_NODES } from "./file-tree.js";
import {
  discoverWorkspacePackages,
  formatWorkspaceGraph,
  readPackageManifest,
  type WorkspacePackage,
} from "./workspace-discovery.js";

const MAX_CONTEXT_BYTES = 50_000;
const DEFAULT_TREE_DEPTH = 5;
const SNAPSHOT_MANIFEST_FILE = "context.manifest.json";

function snapshotArtifactNames(generation: string) {
  return {
    markdown: `context.${generation}.md`,
    graph: `context.${generation}.json`,
    meta: `context.${generation}.meta.json`,
  } as const;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// Resolve through symlinks and check `targetPath` stays inside the trusted root.
// A not-yet-existent path resolves to null and counts as contained.
async function resolvesWithinRoot(targetPath: string, normalizedRoot: string): Promise<boolean> {
  const real = await realpath(targetPath).catch(() => null);
  if (real === null) return true;
  return real === normalizedRoot || real.startsWith(normalizedRoot + path.sep);
}

// Realpath-compare a cached snapshot's stored root against the current project
// root so a foreign in-repo cache for a different checkout is not reused.
async function cachedRootMatchesProject(root: string, normalizedRoot: string): Promise<boolean> {
  const real = await realpath(root).catch(() => path.resolve(root));
  return real === normalizedRoot;
}

// Truncate to fit `maxBytes` of UTF-8, cutting on a newline or code-point
// boundary — never mid-character (would append a U+FFFD replacement).
function truncateToByteLimit(text: string, maxBytes: number): string {
  const buffer = Buffer.from(text, "utf-8");
  if (buffer.byteLength <= maxBytes) return text;

  // Back off over UTF-8 continuation bytes (0b10xxxxxx).
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

// Build writes immutable generation artifacts as regular files, so a symlink is
// a planted escape — skip it rather than follow the link on read.
async function isSymlinkedCacheFile(filePath: string): Promise<boolean> {
  const stats = await lstat(filePath).catch(() => null);
  return stats?.isSymbolicLink() ?? false;
}

export async function loadContextSnapshot(
  contextDir: string,
): Promise<ProjectContextSnapshot | null> {
  // Cache lives at `<projectRoot>/.diffgazer`; mirror the build path's guards so
  // this read follows neither a symlinked `.diffgazer` nor foreign artifacts.
  const projectRoot = path.dirname(contextDir);
  const normalizedRoot = await realpath(projectRoot).catch(() => path.resolve(projectRoot));
  if (!(await resolvesWithinRoot(contextDir, normalizedRoot))) {
    log("warn", "context_snapshot_escaping_dir", { contextDir });
    return null;
  }
  try {
    const manifestPath = path.join(contextDir, SNAPSHOT_MANIFEST_FILE);
    if (await isSymlinkedCacheFile(manifestPath)) {
      log("warn", "context_snapshot_symlinked_manifest", { contextDir });
      return null;
    }
    const manifestRaw = await readFile(manifestPath, "utf8");
    const manifestResult = ProjectContextSnapshotManifestSchema.safeParse(JSON.parse(manifestRaw));
    if (!manifestResult.success) {
      log("warn", "context_snapshot_invalid_manifest", { contextDir });
      return null;
    }

    const manifest = manifestResult.data;
    const expectedNames = snapshotArtifactNames(manifest.generation);
    if (
      manifest.artifacts.markdown.file !== expectedNames.markdown ||
      manifest.artifacts.graph.file !== expectedNames.graph ||
      manifest.artifacts.meta.file !== expectedNames.meta
    ) {
      log("warn", "context_snapshot_manifest_file_mismatch", { contextDir });
      return null;
    }

    const markdownPath = path.join(contextDir, expectedNames.markdown);
    const graphPath = path.join(contextDir, expectedNames.graph);
    const metaPath = path.join(contextDir, expectedNames.meta);
    for (const cachePath of [markdownPath, graphPath, metaPath]) {
      if (await isSymlinkedCacheFile(cachePath)) {
        log("warn", "context_snapshot_symlinked_cache_file", { contextDir });
        return null;
      }
    }
    const [markdown, graphRaw, metaRaw] = await Promise.all([
      readFile(markdownPath, "utf8"),
      readFile(graphPath, "utf8"),
      readFile(metaPath, "utf8"),
    ]);
    if (
      sha256(markdown) !== manifest.artifacts.markdown.sha256 ||
      sha256(graphRaw) !== manifest.artifacts.graph.sha256 ||
      sha256(metaRaw) !== manifest.artifacts.meta.sha256
    ) {
      log("warn", "context_snapshot_hash_mismatch", {
        contextDir,
        generation: manifest.generation,
      });
      return null;
    }
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
    if (
      !(await cachedRootMatchesProject(parsed.data.meta.root, normalizedRoot)) ||
      !(await cachedRootMatchesProject(parsed.data.graph.root, normalizedRoot))
    ) {
      log("warn", "context_snapshot_root_mismatch", { contextDir });
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
const lockSnapshot = createKeyedLock(snapshotLocks);

// Serialize builds per root so concurrent builders cannot race manifest pointer
// publication.
function withSnapshotLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  return lockSnapshot(projectPath, fn);
}

export function buildProjectContextSnapshot(
  projectPath: string,
  options: { force?: boolean } = {},
): Promise<ProjectContextSnapshot> {
  return withSnapshotLock(projectPath, () => buildSnapshot(projectPath, options));
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

async function buildSnapshot(
  projectPath: string,
  options: { force?: boolean },
): Promise<ProjectContextSnapshot> {
  const normalizedRoot = await realpath(projectPath).catch(() => path.resolve(projectPath));
  const contextDir = path.join(projectPath, ".diffgazer");
  if (!(await resolvesWithinRoot(contextDir, normalizedRoot))) {
    throw new Error("Context cache directory resolves outside the project root");
  }
  await mkdir(contextDir, { recursive: true, mode: 0o700 });

  const gitService = createGitService({ cwd: projectPath });
  const [statusHashResult, headCommitResult] = await Promise.all([
    gitService.getStatusHash().catch(() => ({ kind: "unavailable" as const })),
    gitService.getHeadCommit().catch(() => ({ ok: false as const, error: { message: "unknown" } })),
  ]);
  const currentHash = statusHashResult.kind === "unavailable" ? "" : statusHashResult.hash;
  const currentHashKind = statusHashResult.kind;
  const currentHeadCommit = headCommitResult.ok ? headCommitResult.value : "";

  const cached = await loadContextSnapshot(contextDir);
  if (
    cached &&
    !options.force &&
    currentHashKind === "full" &&
    cached.meta.statusHashKind === "full" &&
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
    statusHash: currentHash,
    statusHashKind: currentHashKind,
    headCommit: currentHeadCommit || undefined,
    charCount: rawMarkdown.length,
    ...(treeCounter.truncated ? { treeTruncated: true } : {}),
  });
  if (!metaResult.success) {
    throw new Error(`Failed to build context metadata: ${metaResult.error.message}`);
  }
  const meta: ProjectContextMeta = metaResult.data;

  const generation = randomUUID();
  const artifactNames = snapshotArtifactNames(generation);
  const graphContent = JSON.stringify(graph, null, 2);
  const metaContent = JSON.stringify(meta, null, 2);
  await Promise.all([
    atomicWriteFile(path.join(contextDir, artifactNames.graph), graphContent),
    atomicWriteFile(path.join(contextDir, artifactNames.markdown), rawMarkdown),
    atomicWriteFile(path.join(contextDir, artifactNames.meta), metaContent),
  ]);
  const manifest = ProjectContextSnapshotManifestSchema.parse({
    version: 1,
    generation,
    artifacts: {
      markdown: { file: artifactNames.markdown, sha256: sha256(rawMarkdown) },
      graph: { file: artifactNames.graph, sha256: sha256(graphContent) },
      meta: { file: artifactNames.meta, sha256: sha256(metaContent) },
    },
  });
  await atomicWriteFile(
    path.join(contextDir, SNAPSHOT_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
  );

  return { markdown: rawMarkdown, graph, meta };
}
