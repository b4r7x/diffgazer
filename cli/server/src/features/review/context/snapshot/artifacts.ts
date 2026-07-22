import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { ProjectContextSnapshot } from "@diffgazer/core/schemas/context";
import {
  ProjectContextSnapshotManifestSchema,
  ProjectContextSnapshotSchema,
} from "@diffgazer/core/schemas/context";
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

export async function publishContextSnapshot(
  contextDir: string,
  snapshot: ProjectContextSnapshot,
): Promise<void> {
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
  await atomicWriteFile(
    path.join(contextDir, SNAPSHOT_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
  );
}
