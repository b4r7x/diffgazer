import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateManifest } from "../manifest.js";
import { resolveInside } from "../utils/fs.js";
import { readJson } from "../utils/json.js";
import type { ArtifactLibrary } from "./docs-libraries-config.js";
import { assertSafeLibraryId } from "./library-id-validation.js";

export interface MissingArtifactFile {
  id: string;
  path: string;
  relativePath: string;
}

export function resolveArtifactPath(baseDir: string, relPath: string, label: string): string {
  try {
    return resolveInside(baseDir, relPath, label);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(`${label} must be a relative path inside`)
    ) {
      throw new Error(`${label} escapes ${resolve(baseDir)}: ${relPath}`, { cause: error });
    }
    throw error;
  }
}

export function collectMissingWorkspaceArtifactFiles(
  workspaceRoot: string,
  libraries: ArtifactLibrary[],
): MissingArtifactFile[] {
  return libraries.flatMap((library) => {
    assertSafeLibraryId(library.id, `${library.id} artifact library id`);
    const libraryRoot = resolveInside(
      workspaceRoot,
      library.workspaceDir,
      `${library.id} workspace directory`,
    );
    const artifactRoot = resolve(libraryRoot, "dist/artifacts");
    const manifestRelPath = `${library.workspaceDir}/dist/artifacts/artifact-manifest.json`;
    const manifestPath = resolve(workspaceRoot, manifestRelPath);
    const missing: MissingArtifactFile[] = [];

    function addMissing(relPath: string): void {
      const path = resolve(workspaceRoot, relPath);
      if (!existsSync(path)) {
        missing.push({ id: library.id, path, relativePath: relPath });
      }
    }

    addMissing(manifestRelPath);
    addMissing(`${library.workspaceDir}/dist/artifacts/fingerprint.sha256`);

    if (!existsSync(manifestPath)) return missing;

    const manifestResult = validateManifest(readJson(manifestPath));
    if (!manifestResult.success) {
      missing.push({
        id: library.id,
        path: manifestPath,
        relativePath: `${manifestRelPath} (invalid: ${manifestResult.errors.join("; ")})`,
      });
      return missing;
    }

    const manifest = manifestResult.data;
    const expectedArtifactPaths = [
      manifest.docs?.contentDir,
      manifest.docs?.metaFile,
      manifest.docs?.assetsDir,
      manifest.docs?.generatedDir,
      manifest.registry?.publicDir,
      manifest.registry?.index,
      manifest.source?.registryDir,
      manifest.source?.stylesDir,
      ...Object.values(manifest.generated ?? {}),
    ].filter((relPath): relPath is string => typeof relPath === "string" && relPath.length > 0);

    for (const relPath of expectedArtifactPaths) {
      const artifactPath = resolveArtifactPath(
        artifactRoot,
        relPath,
        `${library.id} artifact path`,
      );
      if (!existsSync(artifactPath)) {
        missing.push({
          id: library.id,
          path: artifactPath,
          relativePath: `${library.workspaceDir}/dist/artifacts/${relPath}`,
        });
      }
    }

    return missing;
  });
}
