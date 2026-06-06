import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadArtifactsFromPackage } from "../artifact-loader.js";
import { ARTIFACT_MANIFEST_REL_PATH } from "../constants.js";
import { computeInputsFingerprint } from "../fingerprint.js";
import type { ArtifactManifest } from "../manifest.js";
import { loadValidatedManifest } from "../manifest.js";
import { ensureExists, resolveInside } from "../utils/fs.js";
import type { LoadedLibraryArtifacts, SyncLibraryConfig } from "./types.js";

function getManifestGeneratedFiles(manifest: ArtifactManifest): string[] {
  if (!manifest.generated) return [];
  return Object.values(manifest.generated);
}

function assertUniqueGeneratedOutputNames(
  libraryId: string,
  generatedFiles: string[],
): void {
  const seen = new Map<string, string>();

  for (const generatedFile of generatedFiles) {
    const outputName = basename(generatedFile);
    const firstSource = seen.get(outputName);
    if (firstSource) {
      throw new Error(
        [
          `${libraryId} manifest.generated contains duplicate output name "${outputName}".`,
          `First source:  ${firstSource}`,
          `Second source: ${generatedFile}`,
          "Generated files are copied by basename during docs sync.",
        ].join("\n"),
      );
    }
    seen.set(outputName, generatedFile);
  }
}

function toLoadedLibraryArtifacts(params: {
  id: string;
  manifest: ArtifactManifest;
  manifestPath: string;
  artifactRoot: string;
  fingerprintPath: string;
  fingerprint: string;
}): LoadedLibraryArtifacts {
  const {
    id,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint,
  } = params;
  const generatedFiles = getManifestGeneratedFiles(manifest);
  assertUniqueGeneratedOutputNames(id, generatedFiles);

  return {
    id,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint,
    generatedFiles,
  };
}

function loadFromPackage(
  config: SyncLibraryConfig,
  docsRoot: string,
): LoadedLibraryArtifacts {
  const loaded = loadArtifactsFromPackage({
    packageName: config.packageName,
    from: docsRoot,
  });

  return toLoadedLibraryArtifacts({
    id: config.id,
    manifest: loaded.manifest,
    manifestPath: loaded.manifestPath,
    artifactRoot: loaded.artifactRoot,
    fingerprintPath: resolveInside(
      loaded.artifactRoot,
      loaded.manifest.integrity.fingerprintFile,
      `${config.id} artifact fingerprint path`,
    ),
    fingerprint: loaded.fingerprint,
  });
}

function loadFromWorkspace(
  config: SyncLibraryConfig,
  workspaceRoot: string,
): LoadedLibraryArtifacts {
  const libraryRoot = resolveInside(
    workspaceRoot,
    config.workspaceDir,
    `${config.id} workspace directory`,
  );
  const manifestPath = resolveInside(
    libraryRoot,
    ARTIFACT_MANIFEST_REL_PATH,
    `${config.id} artifact manifest path`,
  );
  ensureExists(manifestPath, `${config.id} artifact manifest`);

  const manifest = loadValidatedManifest(manifestPath, config.id);
  const artifactRoot = resolveInside(
    libraryRoot,
    manifest.artifactRoot,
    `${config.id} artifact root`,
  );
  const fingerprintPath = resolveInside(
    artifactRoot,
    manifest.integrity.fingerprintFile,
    `${config.id} artifact fingerprint path`,
  );
  ensureExists(fingerprintPath, `${config.id} artifact fingerprint`);

  const expectedFingerprint = readFileSync(fingerprintPath, "utf-8").trim();
  const currentFingerprint = computeInputsFingerprint(
    libraryRoot,
    manifest.inputs,
  );

  if (expectedFingerprint !== currentFingerprint) {
    throw new Error(
      [
        `${config.id} artifacts are stale.`,
        `Expected fingerprint: ${expectedFingerprint}`,
        `Current fingerprint:  ${currentFingerprint}`,
        `Rebuild artifacts: run build:artifacts in ${config.workspaceDir}`,
      ].join("\n"),
    );
  }

  return toLoadedLibraryArtifacts({
    id: config.id,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint: expectedFingerprint,
  });
}

export function loadLibraryArtifacts(
  config: SyncLibraryConfig,
  mode: "workspace" | "package",
  docsRoot: string,
  workspaceRoot: string,
): LoadedLibraryArtifacts {
  if (mode === "workspace") {
    return loadFromWorkspace(config, workspaceRoot);
  }
  return loadFromPackage(config, docsRoot);
}
