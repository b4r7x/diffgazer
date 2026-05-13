import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { ARTIFACT_MANIFEST_REL_PATH } from "./constants.js";
import { loadValidatedManifest } from "./manifest.js";
import type { ArtifactManifest } from "./manifest.js";
import { ensureExists, resolveInside } from "./utils/fs.js";

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

const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;

function assertPackageName(name: string): void {
  if (PACKAGE_NAME_RE.test(name)) return;
  throw new Error(`Artifact package name must be an npm package name: ${name}`);
}

export function loadArtifactsFromPackage(
  options: LoadFromPackageOptions,
): LoadedArtifacts {
  const {
    packageName,
    manifestRelPath = ARTIFACT_MANIFEST_REL_PATH,
    from = process.cwd(),
  } = options;

  assertPackageName(packageName);

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

  const manifestPath = resolveInside(
    packageDir,
    manifestRelPath,
    `${packageName} artifact manifest path`,
  );
  ensureExists(manifestPath, `${packageName} artifact manifest`);

  const manifest = loadValidatedManifest(manifestPath, packageName);
  const artifactRoot = resolveInside(
    packageDir,
    manifest.artifactRoot,
    `${packageName} artifact root`,
  );
  const fingerprintPath = resolveInside(
    artifactRoot,
    manifest.integrity.fingerprintFile,
    `${packageName} artifact fingerprint path`,
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
