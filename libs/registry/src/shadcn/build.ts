import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeOrigin, rewriteOriginsInDir } from "../origin.js";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "../registry-types.js";
import { resolveInside } from "../utils/fs.js";
import { readJson } from "../utils/json.js";
import { resolveLocalShadcnBin, runShadcnRegistryBuild } from "./runner.js";
import { validatePublicRegistryFresh } from "./validate.js";

// Mirror the tsup styles.css aggregation (libs/ui/tsup.config.ts): start from the
// seed styles.css, then append every non-`registry:theme` registry CSS file in
// source-registry order. Theme CSS is already imported by the seed and is not
// re-appended. The shadcn direct-URL/namespace path ships this aggregated
// styles.css; the UI registry's afterBuild transform removes duplicate per-item
// style payloads. Source/copy/package consumers continue to receive authored CSS.
export function aggregateThemeStyles(params: {
  rootDir: string;
  sourceRegistryPath: string;
  seedContent: string;
}): string {
  const { rootDir, sourceRegistryPath, seedContent } = params;
  const registry = readJson(resolve(rootDir, sourceRegistryPath), RegistrySchema);

  let aggregated = seedContent;
  const appendedPaths = new Set<string>();
  for (const item of registry.items) {
    if (item.type === REGISTRY_ITEM_TYPE.theme) continue;
    for (const file of item.files) {
      if (!file.path.endsWith(".css")) continue;
      const cssPath = resolveInside(rootDir, file.path, `Registry CSS path for "${item.name}"`);
      if (appendedPaths.has(cssPath)) continue;
      if (!existsSync(cssPath)) {
        throw new Error(`Registry CSS file is missing: ${file.path}`);
      }
      appendedPaths.add(cssPath);
      aggregated += `\n${readFileSync(cssPath, "utf-8")}`;
    }
  }
  return aggregated;
}

export interface EnsurePublicRegistryReadyOptions {
  rootDir: string;
  fixCommand: string;
  sourceRegistryPath?: string;
  publicRegistryDir?: string;
  label?: string;
  afterBuild?: (ctx: { rootDir: string; outputDir: string }) => void;
  transformSourceItem?: Parameters<typeof validatePublicRegistryFresh>[0]["transformSourceItem"];
  transformSourceContent?: Parameters<
    typeof validatePublicRegistryFresh
  >[0]["transformSourceContent"];
  shouldSkipSourceItem?: Parameters<typeof validatePublicRegistryFresh>[0]["shouldSkipSourceItem"];
}

export function ensurePublicRegistryReady(options: EnsurePublicRegistryReadyOptions): void {
  const {
    rootDir,
    fixCommand,
    sourceRegistryPath = "registry/registry.json",
    publicRegistryDir = "public/r",
    label = "public registry index",
    afterBuild,
    transformSourceItem,
    transformSourceContent,
    shouldSkipSourceItem,
  } = options;

  const publicRegistryIndex = resolve(rootDir, publicRegistryDir, "registry.json");
  const hasLocalShadcn = Boolean(resolveLocalShadcnBin(rootDir));

  const rebuild = () => {
    runShadcnRegistryBuild({
      rootDir,
      registryPath: sourceRegistryPath,
      outputDir: publicRegistryDir,
    });
    afterBuild?.({ rootDir, outputDir: resolve(rootDir, publicRegistryDir) });
  };

  const validate = () => {
    validatePublicRegistryFresh({
      rootDir,
      fixCommand,
      sourceRegistryPath,
      publicRegistryDir,
      transformSourceItem,
      transformSourceContent,
      shouldSkipSourceItem,
    });
  };

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

    rebuild();
  }

  try {
    validate();
  } catch (error) {
    if (!hasLocalShadcn) throw error;

    rebuild();
    validate();
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
  afterBuild?: (ctx: { rootDir: string; outputDir: string }) => void;
}

export interface BuildShadcnRegistryWithOriginResult {
  origin: string;
  outputDir: string;
}

export function buildShadcnRegistryWithOrigin(
  options: BuildShadcnRegistryWithOriginOptions,
): BuildShadcnRegistryWithOriginResult {
  const {
    rootDir,
    registryPath = "registry/registry.json",
    outputDir = "public/r",
    originRaw = process.env.REGISTRY_ORIGIN,
    defaultOrigin,
    fromOrigin = defaultOrigin,
    beforeBuild,
    afterBuild,
  } = options;

  const origin = normalizeOrigin(originRaw, { defaultOrigin });

  beforeBuild?.();

  runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
  afterBuild?.({ rootDir, outputDir: resolve(rootDir, outputDir) });

  rewriteOriginsInDir(resolve(rootDir, outputDir), {
    fromOrigin,
    toOrigin: origin,
  });

  return {
    origin,
    outputDir: resolve(rootDir, outputDir),
  };
}
