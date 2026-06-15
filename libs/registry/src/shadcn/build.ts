import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAndRewriteOrigin } from "../origin.js";
import { REGISTRY_ITEM_TYPE, RegistrySchema } from "../registry-types.js";
import { readJson } from "../utils/json.js";
import { resolveLocalShadcnBin, runShadcnRegistryBuild } from "./runner.js";
import { validatePublicRegistryFresh } from "./validate.js";

// Mirror the tsup styles.css aggregation (libs/ui/tsup.config.ts): start from the
// seed styles.css, then append every non-`registry:theme` registry CSS file in
// source-registry order. Theme CSS is already imported by the seed and is not
// re-appended. The shadcn direct-URL/namespace path ships only this aggregated
// styles.css, so a `npx shadcn add` of the theme item carries the component CSS
// (dialog backdrop/body-lock, etc.) that per-item `~/styles/<name>.css` files do
// not import — keeping all three install paths (copy/package/shadcn) at parity.
export function aggregateThemeStyles(params: {
  rootDir: string;
  sourceRegistryPath: string;
  seedContent: string;
}): string {
  const { rootDir, sourceRegistryPath, seedContent } = params;
  const registry = readJson(resolve(rootDir, sourceRegistryPath), RegistrySchema);

  let aggregated = seedContent;
  for (const item of registry.items) {
    if (item.type === REGISTRY_ITEM_TYPE.theme) continue;
    for (const file of item.files) {
      if (!file.path.endsWith(".css")) continue;
      const cssPath = resolve(rootDir, file.path);
      if (!existsSync(cssPath)) {
        throw new Error(`Registry CSS file is missing: ${file.path}`);
      }
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
  registryPath?: string;
  outputDir?: string;
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
    registryPath = sourceRegistryPath,
    outputDir = publicRegistryDir,
    label = "public registry index",
    afterBuild,
    transformSourceItem,
    transformSourceContent,
    shouldSkipSourceItem,
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
    afterBuild?.({ rootDir, outputDir: resolve(rootDir, outputDir) });
  }

  try {
    validatePublicRegistryFresh({
      rootDir,
      fixCommand,
      sourceRegistryPath,
      publicRegistryDir,
      transformSourceItem,
      transformSourceContent,
      shouldSkipSourceItem,
    });
  } catch (error) {
    if (!hasLocalShadcn) throw error;

    runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
    afterBuild?.({ rootDir, outputDir: resolve(rootDir, outputDir) });
    validatePublicRegistryFresh({
      rootDir,
      fixCommand,
      sourceRegistryPath,
      publicRegistryDir,
      transformSourceItem,
      transformSourceContent,
      shouldSkipSourceItem,
    });
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

  beforeBuild?.();

  runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
  afterBuild?.({ rootDir, outputDir: resolve(rootDir, outputDir) });

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
