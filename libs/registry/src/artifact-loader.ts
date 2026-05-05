import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { ARTIFACT_MANIFEST_REL_PATH } from "./constants.js";
import { loadValidatedManifest } from "./manifest.js";
import type { ArtifactManifest } from "./manifest.js";
import { ensureExists } from "./utils/fs.js";

export interface LoadedArtifacts {
  manifest: ArtifactManifest;
  manifestPath: string;
  artifactRoot: string;
  packageRoot: string;
  fingerprint: string;
}

export interface LoadFromPackageOptions {
  packageName: string;
  manifestRelPath?: string;
  from?: string;
}

export function loadArtifactsFromPackage(
  options: LoadFromPackageOptions,
): LoadedArtifacts {
  const {
    packageName,
    manifestRelPath = ARTIFACT_MANIFEST_REL_PATH,
    from = process.cwd(),
  } = options;

  const require = createRequire(resolve(from, "package.json"));
  let packageDir: string;
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    packageDir = dirname(pkgJsonPath);
  } catch {
    throw new Error(
      `Cannot resolve package "${packageName}" from "${from}". Is it installed?`,
    );
  }

  const manifestPath = resolve(packageDir, manifestRelPath);
  ensureExists(manifestPath, `${packageName} artifact manifest`);

  const manifest = loadValidatedManifest(manifestPath, packageName);
  const artifactRoot = resolve(packageDir, manifest.artifactRoot);
  const fingerprintPath = resolve(
    artifactRoot,
    manifest.integrity.fingerprintFile,
  );
  ensureExists(fingerprintPath, `${packageName} artifact fingerprint`);

  const fingerprint = readFileSync(fingerprintPath, "utf-8").trim();

  return {
    manifest,
    manifestPath,
    artifactRoot,
    packageRoot: packageDir,
    fingerprint,
  };
}
