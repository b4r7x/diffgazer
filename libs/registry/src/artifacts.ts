import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARTIFACT_MANIFEST_FILENAME, ARTIFACT_FINGERPRINT_FILENAME, DEFAULT_ARTIFACT_ROOT } from "./constants.js";
import { computeInputsFingerprint } from "./fingerprint.js";
import { normalizeOrigin, rewriteOriginsInDir } from "./origin.js";
import { ensureExists, resetDir } from "./utils/fs.js";
import { writeJson } from "./utils/json.js";
import { ensurePublicRegistryReady, type EnsurePublicRegistryReadyOptions } from "./shadcn/index.js";
import type { ArtifactManifest } from "./manifest.js";
import { defaultLogger, type Logger } from "./logger.js";

export interface CopyDirEntry {
  from: string;
  to: string;
}

export interface RequiredPathEntry {
  path: string;
  label?: string;
}

export interface AfterCopyContext {
  rootDir: string;
  artifactRoot: string;
  origin: string;
}

export interface BuildRegistryArtifactsOptions {
  rootDir: string;
  artifactRoot?: string;
  inputs?: string[];
  manifest: ArtifactManifest;
  manifestFile?: string;
  fingerprintFile?: string;
  ensurePublicRegistry?: Omit<EnsurePublicRegistryReadyOptions, "rootDir">;
  requiredPaths?: Array<string | RequiredPathEntry>;
  copyDirs?: CopyDirEntry[];
  rewriteDirs?: string[];
  originRaw?: string;
  defaultOrigin: string;
  fromOrigin?: string;
  beforeBuild?: () => void;
  afterCopy?: (context: AfterCopyContext) => void;
}

export interface BuildRegistryArtifactsResult {
  origin: string;
  fingerprint: string;
  artifactRoot: string;
  manifestPath: string;
  fingerprintPath: string;
}

export function buildRegistryArtifacts(options: BuildRegistryArtifactsOptions): BuildRegistryArtifactsResult {
  const {
    rootDir,
    artifactRoot = DEFAULT_ARTIFACT_ROOT,
    manifest,
    manifestFile = ARTIFACT_MANIFEST_FILENAME,
    fingerprintFile = ARTIFACT_FINGERPRINT_FILENAME,
    ensurePublicRegistry: ensurePublicRegistryOptions,
    requiredPaths = [],
    copyDirs = [],
    rewriteDirs = [],
    originRaw = process.env.REGISTRY_ORIGIN,
    defaultOrigin,
    fromOrigin = defaultOrigin,
    beforeBuild,
    afterCopy,
  } = options;
  const inputs = options.inputs ?? manifest.inputs ?? [];

  beforeBuild?.();

  if (ensurePublicRegistryOptions) {
    ensurePublicRegistryReady({
      rootDir,
      ...ensurePublicRegistryOptions,
    });
  }

  for (const required of requiredPaths) {
    if (typeof required === "string") {
      ensureExists(resolve(rootDir, required), required);
    } else {
      ensureExists(resolve(rootDir, required.path), required.label ?? required.path);
    }
  }

  const origin = normalizeOrigin(originRaw, { defaultOrigin });
  const artifactRootPath = resolve(rootDir, artifactRoot);
  resetDir(artifactRootPath);

  for (const copyEntry of copyDirs) {
    const from = resolve(rootDir, copyEntry.from);
    const to = resolve(artifactRootPath, copyEntry.to);
    cpSync(from, to, {
      recursive: true,
      force: true,
      filter: (src) => !/\.(md)$/i.test(src)
        && !/\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(src)
        && !src.includes("__tests__"),
    });
  }

  for (const relativeDir of rewriteDirs) {
    rewriteOriginsInDir(resolve(artifactRootPath, relativeDir), {
      fromOrigin,
      toOrigin: origin,
    });
  }

  afterCopy?.({ rootDir, artifactRoot: artifactRootPath, origin });

  const fingerprint = computeInputsFingerprint(rootDir, inputs);
  const manifestPath = resolve(artifactRootPath, manifestFile);
  const fingerprintPath = resolve(artifactRootPath, fingerprintFile);

  writeJson(manifestPath, manifest);
  writeFileSync(fingerprintPath, `${fingerprint}\n`);

  return {
    origin,
    fingerprint,
    artifactRoot: artifactRootPath,
    manifestPath,
    fingerprintPath,
  };
}

export interface CopyArtifactsToPackageOptions {
  sourceRoot: string;
  packageRoot: string;
  artifactDir?: string;
  label: string;
  rebuildHint?: string;
  validateManifest?: boolean;
  cleanStrategy?: "parent-dist" | "artifact-dir";
  logger?: Logger;
}

export function copyArtifactsToPackage(options: CopyArtifactsToPackageOptions): void {
  const {
    sourceRoot,
    packageRoot,
    artifactDir = DEFAULT_ARTIFACT_ROOT,
    label,
    rebuildHint,
    validateManifest: shouldValidateManifest = true,
    cleanStrategy = "parent-dist",
    logger = defaultLogger,
  } = options;

  const source = resolve(sourceRoot, artifactDir);
  const target = resolve(packageRoot, artifactDir);

  if (!existsSync(source)) {
    const hint = rebuildHint ? `\nRun: ${rebuildHint}` : "";
    throw new Error(`${label} artifacts not found at ${source}.${hint}`);
  }

  if (shouldValidateManifest) {
    ensureExists(resolve(source, ARTIFACT_MANIFEST_FILENAME), `${label} artifact manifest`);
    ensureExists(resolve(source, ARTIFACT_FINGERPRINT_FILENAME), `${label} artifact fingerprint`);
  }

  if (cleanStrategy === "parent-dist") {
    const parentDist = resolve(packageRoot, "dist");
    rmSync(parentDist, { recursive: true, force: true });
    mkdirSync(parentDist, { recursive: true });
  } else {
    rmSync(target, { recursive: true, force: true });
  }

  cpSync(source, target, { recursive: true, force: true });

  logger.info(`[${label}] copied artifacts from ${source}`);
}
