import { isDeepStrictEqual } from "node:util";
import { REGISTRY_ORIGIN } from "@diffgazer/registry/cli";
import {
  ctx,
  type DiffgazerAddConfig,
  DiffgazerAddConfigSchema,
  resolveConfig,
  VERSION,
} from "../../context.js";
import type { detectProject } from "../../utils/detect.js";
import { resolveInstalledItemsForInit } from "./ledger.js";
import { initPlan, parseInitOptions, resolveInitProject } from "./plan.js";

interface InitTopology {
  aliases: NonNullable<DiffgazerAddConfig["aliases"]>;
  componentsFsPath: string;
  libFsPath: string;
  hooksFsPath: string;
  rsc: boolean;
  tailwind: NonNullable<DiffgazerAddConfig["tailwind"]>;
}

function deriveInitTopology(cwd: string, opts: Record<string, unknown>): InitTopology {
  const { project, componentsDir, libDir, stylesDir, hooksDir } = initPlan(cwd, opts);
  const paths = {
    componentsFsPath: componentsDir,
    libFsPath: libDir,
    hooksFsPath: hooksDir,
  };

  return {
    aliases: aliasesFromResolvedPaths(project, paths),
    ...paths,
    rsc: project.rsc,
    tailwind: { css: `${stylesDir}/styles.css` },
  };
}

function aliasesFromResolvedPaths(
  project: ReturnType<typeof detectProject>,
  paths: Pick<InitTopology, "componentsFsPath" | "libFsPath" | "hooksFsPath">,
): InitTopology["aliases"] {
  const stripSource = (path: string) => {
    const prefix = project.sourceDir === "." ? "" : `${project.sourceDir}/`;
    return prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
  };
  const aliasPath = (path: string) => `${project.importAliasPrefix}/${path}`;
  return {
    components: aliasPath(stripSource(paths.componentsFsPath)),
    utils: aliasPath(`${stripSource(paths.libFsPath)}/utils`),
    lib: aliasPath(stripSource(paths.libFsPath)),
    hooks: aliasPath(stripSource(paths.hooksFsPath)),
  };
}

interface RecoveredConfig {
  config: DiffgazerAddConfig;
  droppedFields: Set<string>;
}

// `--force` hands this the raw JSON when diffgazer.json parses but fails schema
// validation, so keep only the fields that validate on their own instead of
// deriving the comparison topology from arbitrary values.
function recoverExistingConfig(
  value: DiffgazerAddConfig | Record<string, unknown>,
): RecoveredConfig {
  const parsed = DiffgazerAddConfigSchema.safeParse(value);
  if (parsed.success) return { config: parsed.data, droppedFields: new Set() };

  const shape = DiffgazerAddConfigSchema.shape;
  const kept: Record<string, unknown> = {};
  const droppedFields = new Set<string>();
  for (const [key, field] of Object.entries(value)) {
    const fieldSchema = shape[key as keyof typeof shape];
    if (fieldSchema && !fieldSchema.safeParse(field).success) {
      droppedFields.add(key);
      continue;
    }
    kept[key] = field;
  }
  return { config: DiffgazerAddConfigSchema.parse(kept), droppedFields };
}

function existingInitTopology(cwd: string, existing: RecoveredConfig): InitTopology {
  const resolved = resolveConfig(existing.config, cwd);
  const tailwind = resolved.tailwind ?? { css: `${resolved.stylesFsPath}/styles.css` };
  const paths = {
    componentsFsPath: resolved.componentsFsPath,
    libFsPath: resolved.libFsPath,
    hooksFsPath: resolved.hooksFsPath,
  };

  return {
    aliases: existing.droppedFields.has("aliases")
      ? aliasesFromResolvedPaths(resolveInitProject(cwd, parseInitOptions({})), paths)
      : resolved.aliases,
    ...paths,
    rsc: resolved.rsc,
    tailwind,
  };
}

export function validateReinitializeTopology(context: {
  cwd: string;
  existingConfig: DiffgazerAddConfig | Record<string, unknown>;
  options: Record<string, unknown>;
}): void {
  const initOptions = parseInitOptions(context.options);
  const existingConfig = recoverExistingConfig(context.existingConfig);
  const installedItems = existingConfig.config.installedItems;
  if (initOptions.resetManifest || !installedItems || Object.keys(installedItems).length === 0) {
    return;
  }

  const existing = existingInitTopology(context.cwd, existingConfig);
  const next = deriveInitTopology(context.cwd, context.options);
  if (isDeepStrictEqual(existing, next)) return;

  throw new Error(
    "Cannot change the install topology while preserving installed components. " +
      "Keep the existing component paths and source aliases, or migrate the installed files " +
      "before re-running with --force --reset-manifest.",
  );
}

// init --force re-derives config choices but carries installedItems across
// so add/diff/remove do not orphan already-installed files; only --reset-manifest
// drops the ledger.
export function writeInitConfig(cwd: string, opts: Record<string, unknown>): void {
  const topology = deriveInitTopology(cwd, opts);
  const installedItems = resolveInstalledItemsForInit(cwd, parseInitOptions(opts));

  ctx.config.writeConfig(cwd, {
    $schema: `${REGISTRY_ORIGIN}/schema/diffgazer.json`,
    version: VERSION,
    ...topology,
    ...(installedItems ? { installedItems } : {}),
  });
}
