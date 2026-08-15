import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { scanJsonRejectingDuplicateKeys } from "@diffgazer/core/json";
import type { ProjectContextSnapshot } from "@diffgazer/core/schemas/context";
import {
  MAX_CONTEXT_GRAPH_JSON_BYTES,
  MAX_CONTEXT_JSON_DEPTH,
  MAX_CONTEXT_MANIFEST_JSON_BYTES,
  MAX_CONTEXT_MARKDOWN_BYTES,
  MAX_CONTEXT_META_JSON_BYTES,
  ProjectContextSnapshotManifestSchema,
  ProjectContextSnapshotSchema,
} from "@diffgazer/core/schemas/context";
import { withFileTransactionLock } from "../../../../shared/lib/config/transaction/file-lock.js";
import { formatSchemaIssues } from "../../../../shared/lib/errors.js";
import { atomicWriteFile } from "../../../../shared/lib/fs.js";
import { log } from "../../../../shared/lib/log.js";

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
export async function resolvesWithinRoot(
  targetPath: string,
  normalizedRoot: string,
): Promise<boolean> {
  const real = await realpath(targetPath).catch(() => null);
  if (real === null) return true;
  return real === normalizedRoot || real.startsWith(normalizedRoot + path.sep);
}

async function cachedRootMatchesProject(root: string, normalizedRoot: string): Promise<boolean> {
  const real = await realpath(root).catch(() => path.resolve(root));
  return real === normalizedRoot;
}

async function isSymlinkedCacheFile(filePath: string): Promise<boolean> {
  const stats = await lstat(filePath).catch(() => null);
  return stats?.isSymbolicLink() ?? false;
}

async function readBoundedUtf8(filePath: string, maxBytes: number): Promise<string | null> {
  const stats = await lstat(filePath).catch(() => null);
  if (!stats?.isFile() || stats.size > maxBytes) return null;
  return readFile(filePath, "utf8");
}

function parseBoundedJson(raw: string, maxBytes: number): unknown | null {
  try {
    scanJsonRejectingDuplicateKeys(raw, {
      maxBytes,
      maxDepth: MAX_CONTEXT_JSON_DEPTH,
      onFail: () => {
        throw new TypeError("context JSON exceeds bounded scan limits");
      },
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadContextSnapshot(
  contextDir: string,
): Promise<ProjectContextSnapshot | null> {
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
    const manifestRaw = await readBoundedUtf8(manifestPath, MAX_CONTEXT_MANIFEST_JSON_BYTES);
    if (manifestRaw === null) {
      log("warn", "context_snapshot_oversized_manifest", { contextDir });
      return null;
    }
    const manifestJson = parseBoundedJson(manifestRaw, MAX_CONTEXT_MANIFEST_JSON_BYTES);
    if (manifestJson === null) {
      log("warn", "context_snapshot_invalid_manifest", { contextDir });
      return null;
    }
    const manifestResult = ProjectContextSnapshotManifestSchema.safeParse(manifestJson);
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
      readBoundedUtf8(markdownPath, MAX_CONTEXT_MARKDOWN_BYTES),
      readBoundedUtf8(graphPath, MAX_CONTEXT_GRAPH_JSON_BYTES),
      readBoundedUtf8(metaPath, MAX_CONTEXT_META_JSON_BYTES),
    ]);
    if (markdown === null || graphRaw === null || metaRaw === null) {
      log("warn", "context_snapshot_oversized_artifact", {
        contextDir,
        generation: manifest.generation,
      });
      return null;
    }
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
    const graphJson = parseBoundedJson(graphRaw, MAX_CONTEXT_GRAPH_JSON_BYTES);
    const metaJson = parseBoundedJson(metaRaw, MAX_CONTEXT_META_JSON_BYTES);
    if (graphJson === null || metaJson === null) {
      log("warn", "context_snapshot_invalid_json", {
        contextDir,
        generation: manifest.generation,
      });
      return null;
    }
    const parsed = ProjectContextSnapshotSchema.safeParse({
      markdown,
      graph: graphJson,
      meta: metaJson,
    });
    if (!parsed.success) {
      log("warn", "context_snapshot_invalid", {
        contextDir,
        issues: formatSchemaIssues(parsed.error),
      });
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

export function publishContextSnapshot(
  contextDir: string,
  snapshot: ProjectContextSnapshot,
): Promise<void> {
  const manifestPath = path.join(contextDir, SNAPSHOT_MANIFEST_FILE);
  return withFileTransactionLock(manifestPath, async () => {
    let previousGeneration: string | null = null;
    try {
      if (!(await isSymlinkedCacheFile(manifestPath))) {
        const previousManifestRaw = await readBoundedUtf8(
          manifestPath,
          MAX_CONTEXT_MANIFEST_JSON_BYTES,
        );
        if (previousManifestRaw !== null) {
          const previousManifestJson = parseBoundedJson(
            previousManifestRaw,
            MAX_CONTEXT_MANIFEST_JSON_BYTES,
          );
          if (previousManifestJson !== null) {
            const previousManifest =
              ProjectContextSnapshotManifestSchema.safeParse(previousManifestJson);
            if (previousManifest.success) previousGeneration = previousManifest.data.generation;
          }
        }
      }
    } catch {
      previousGeneration = null;
    }

    const generation = randomUUID();
    const artifactNames = snapshotArtifactNames(generation);
    const graphContent = JSON.stringify(snapshot.graph, null, 2);
    const metaContent = JSON.stringify(snapshot.meta, null, 2);
    await Promise.all([
      atomicWriteFile(path.join(contextDir, artifactNames.graph), graphContent),
      atomicWriteFile(path.join(contextDir, artifactNames.markdown), snapshot.markdown),
      atomicWriteFile(path.join(contextDir, artifactNames.meta), metaContent),
    ]);
    const manifest = ProjectContextSnapshotManifestSchema.parse({
      version: 1,
      generation,
      artifacts: {
        markdown: { file: artifactNames.markdown, sha256: sha256(snapshot.markdown) },
        graph: { file: artifactNames.graph, sha256: sha256(graphContent) },
        meta: { file: artifactNames.meta, sha256: sha256(metaContent) },
      },
    });
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));

    const retainedGenerations = new Set(
      previousGeneration === null ? [generation] : [generation, previousGeneration],
    );
    try {
      const entries = await readdir(contextDir);
      await Promise.all(
        entries.map(async (entry) => {
          if (entry === SNAPSHOT_MANIFEST_FILE) return;
          const match = /^context\.([A-Za-z0-9_-]{1,128})\.(?:md|json|meta\.json)$/.exec(entry);
          const artifactGeneration = match?.[1];
          if (!artifactGeneration || retainedGenerations.has(artifactGeneration)) return;
          const artifactPath = path.join(contextDir, entry);
          const stats = await lstat(artifactPath).catch(() => null);
          if (!stats?.isFile()) return;
          await unlink(artifactPath);
        }),
      );
    } catch (error) {
      log("warn", "context_snapshot_cleanup_failed", {
        contextDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
