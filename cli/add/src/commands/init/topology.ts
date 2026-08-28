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

  const stripSource = (p: string) => {
    const prefix = project.sourceDir === "." ? "" : `${project.sourceDir}/`;
    return prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p;
  };
  const aliasPath = (path: string) => `${project.importAliasPrefix}/${path}`;
  const aliases = {
    components: aliasPath(stripSource(componentsDir)),
    utils: aliasPath(`${stripSource(libDir)}/utils`),
    lib: aliasPath(stripSource(libDir)),
    hooks: aliasPath(stripSource(hooksDir)),
  };

  return {
    aliases,
    componentsFsPath: componentsDir,
    libFsPath: libDir,
    hooksFsPath: hooksDir,
    rsc: project.rsc,
    tailwind: { css: `${stylesDir}/styles.css` },
  };
}

function areConfigAliasesValid(config: DiffgazerAddConfig): boolean {
  if (config.aliases === undefined) return true;
  return DiffgazerAddConfigSchema.shape.aliases.safeParse(config.aliases).success;
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

function existingInitTopology(cwd: string, config: DiffgazerAddConfig): InitTopology {
  const aliasesValid = areConfigAliasesValid(config);
  const resolved = resolveConfig(aliasesValid ? config : { ...config, aliases: undefined }, cwd);
  const tailwind = resolved.tailwind ?? { css: `${resolved.stylesFsPath}/styles.css` };
  const paths = {
    componentsFsPath: resolved.componentsFsPath,
    libFsPath: resolved.libFsPath,
    hooksFsPath: resolved.hooksFsPath,
  };

  return {
    aliases: aliasesValid
      ? resolved.aliases
      : aliasesFromResolvedPaths(resolveInitProject(cwd, parseInitOptions({})), paths),
    ...paths,
    rsc: resolved.rsc,
    tailwind,
  };
}

export function validateReinitializeTopology(context: {
  cwd: string;
  existingConfig: DiffgazerAddConfig;
  options: Record<string, unknown>;
}): void {
  const initOptions = parseInitOptions(context.options);
  const installedItems = context.existingConfig.installedItems;
  if (initOptions.resetManifest || !installedItems || Object.keys(installedItems).length === 0) {
    return;
  }

  const existing = existingInitTopology(context.cwd, context.existingConfig);
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
