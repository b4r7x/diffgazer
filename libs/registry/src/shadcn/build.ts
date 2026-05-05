import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAndRewriteOrigin } from "../origin.js";
import { resolveLocalShadcnBin, runShadcnRegistryBuild } from "./runner.js";
import { validatePublicRegistryFresh } from "./validate.js";

export interface EnsurePublicRegistryReadyOptions {
  rootDir: string;
  fixCommand: string;
  sourceRegistryPath?: string;
  publicRegistryDir?: string;
  registryPath?: string;
  outputDir?: string;
  label?: string;
}

export function ensurePublicRegistryReady(options: EnsurePublicRegistryReadyOptions): void {
  const {
    rootDir,
    fixCommand,
    sourceRegistryPath = "registry/registry.json",
    publicRegistryDir = "public/r",
    registryPath = sourceRegistryPath,
    outputDir = publicRegistryDir,
    label = "public registry index",
  } = options;

  const publicRegistryIndex = resolve(rootDir, publicRegistryDir, "registry.json");
  const hasLocalShadcn = Boolean(resolveLocalShadcnBin(rootDir));

  if (!existsSync(publicRegistryIndex)) {
    if (!hasLocalShadcn) {
      throw new Error(
        [
          `${label} is missing and local shadcn binary is unavailable.`,
          `Expected: ${publicRegistryIndex}`,
          `Run: ${fixCommand}`,
        ].join("\n"),
      );
    }

    runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
  }

  try {
    validatePublicRegistryFresh({ rootDir, fixCommand, sourceRegistryPath, publicRegistryDir });
  } catch (error) {
    if (!hasLocalShadcn) throw error;

    runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
    validatePublicRegistryFresh({ rootDir, fixCommand, sourceRegistryPath, publicRegistryDir });
  }
}

export interface BuildShadcnRegistryWithOriginOptions {
  rootDir: string;
  registryPath?: string;
  outputDir?: string;
  originRaw?: string;
  defaultOrigin: string;
  fromOrigin?: string;
  beforeBuild?: () => void;
}

export interface BuildShadcnRegistryWithOriginResult {
  origin: string;
  outputDir: string;
}

export function buildShadcnRegistryWithOrigin(options: BuildShadcnRegistryWithOriginOptions): BuildShadcnRegistryWithOriginResult {
  const {
    rootDir,
    registryPath = "registry/registry.json",
    outputDir = "public/r",
    originRaw = process.env.REGISTRY_ORIGIN,
    defaultOrigin,
    fromOrigin = defaultOrigin,
    beforeBuild,
  } = options;

  beforeBuild?.();

  runShadcnRegistryBuild({ rootDir, registryPath, outputDir });

  const { origin } = resolveAndRewriteOrigin({
    dir: resolve(rootDir, outputDir),
    originRaw,
    defaultOrigin,
    fromOrigin,
  });

  return {
    origin,
    outputDir: resolve(rootDir, outputDir),
  };
}
