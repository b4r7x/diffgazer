import { resolve } from "node:path";
import {
  ensureWithinDir,
  isSymlinkTraversalError,
  PACKAGE_MANAGER_LOCKFILES,
} from "@diffgazer/registry/cli";
import { z } from "zod";
import { detectProject } from "../../utils/detect.js";
import {
  assertInsideProject,
  normalizeManifestPath,
  normalizeProjectRelativePath,
  resolveProjectPath,
} from "../../utils/paths.js";
import { assertForceRecoveryAllowed } from "./ledger.js";
import { assertTailwindV4 } from "./scaffold.js";

// Commander hands callbacks a loosely-typed options bag; validate the
// init-specific fields at the boundary instead of casting.
const InitOptionsSchema = z.looseObject({
  componentsDir: z.string().optional(),
  allowMissingAlias: z.boolean().optional(),
  resetManifest: z.boolean().optional(),
  importAliasPrefix: z.string().optional(),
  sourceDir: z.string().optional(),
});

export type InitOptions = z.infer<typeof InitOptionsSchema>;

export function parseInitOptions(opts: Record<string, unknown>): InitOptions {
  return InitOptionsSchema.parse(opts);
}

// Every path init may create, write, or touch — including package.json and the
// lockfiles — so a writeConfig failure after afterFiles rolls them back.
export function buildInitPlannedPaths(cwd: string, opts: Record<string, unknown>): string[] {
  const { componentsDir, libDir, stylesDir, hooksDir } = initPlan(cwd, opts);
  return [
    `${componentsDir}/`,
    `${hooksDir}/`,
    `${libDir}/utils.ts`,
    `${stylesDir}/theme.css`,
    `${stylesDir}/styles.css`,
    "package.json",
    ...PACKAGE_MANAGER_LOCKFILES,
  ];
}

function suggestedComponentsDir(
  cwd: string,
  componentsDir: string,
  project: ReturnType<typeof detectProject>,
): string {
  const sourcePrefix = project.sourceDir === "." ? "" : `${project.sourceDir}/`;
  const requestedDir = componentsDir.replace(/\\/g, "/").replace(/^\.\//, "");
  let resolved = requestedDir;
  try {
    resolved = normalizeManifestPath(cwd, resolveProjectPath(cwd, requestedDir));
  } catch {
    // Keep the requested path when it cannot be resolved inside the project.
  }
  if (project.sourceDir === "." || resolved.startsWith(sourcePrefix)) {
    return resolved;
  }
  return `${sourcePrefix}${resolved}`;
}

function rejectComponentsDirOutsideSource(
  componentsDir: string,
  project: ReturnType<typeof detectProject>,
  cwd: string,
): never {
  const alias = `${project.importAliasPrefix}/*`;
  const suggestedDir = suggestedComponentsDir(cwd, componentsDir, project);
  throw new Error(
    `--components-dir "${componentsDir}" must be inside detected source directory ` +
      `"${project.sourceDir}/" because alias "${alias}" resolves from there. ` +
      `Use --components-dir "${suggestedDir}".`,
  );
}

// An omitted --components-dir derives from the detected source dir; an explicit
// one is honoured verbatim, including when it equals the derived default.
function derivePaths(cwd: string, componentsDir: string | undefined, project = detectProject(cwd)) {
  const sourcePrefix = project.sourceDir === "." ? "" : `${project.sourceDir}/`;
  const resolvedComponentsDir =
    componentsDir === undefined
      ? `${sourcePrefix}components/ui`
      : componentsDir.replace(/\\/g, "/");
  const sourceRoot = resolve(cwd, normalizeProjectRelativePath(project.sourceDir));
  let componentsRoot: string;
  try {
    componentsRoot = resolve(cwd, normalizeProjectRelativePath(resolvedComponentsDir));
  } catch (error) {
    if (error instanceof Error && error.message.includes("Project paths must be relative")) {
      throw error;
    }
    rejectComponentsDirOutsideSource(resolvedComponentsDir, project, cwd);
  }
  try {
    ensureWithinDir(componentsRoot, sourceRoot);
    ensureWithinDir(componentsRoot, cwd);
  } catch (error) {
    // A symlink escape is not a "put it under src/" mistake; surfacing the usage
    // hint would hide it behind a suggestion that fails the same way.
    if (isSymlinkTraversalError(error)) throw error;
    rejectComponentsDirOutsideSource(resolvedComponentsDir, project, cwd);
  }
  return {
    project,
    componentsDir: normalizeManifestPath(cwd, componentsRoot),
    libDir: `${sourcePrefix}lib`,
    stylesDir: `${sourcePrefix}styles`,
    hooksDir: `${sourcePrefix}hooks`,
  };
}

function validateImportAliasPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!/^[@~#][\w-]*$/.test(trimmed)) {
    throw new Error(
      `Invalid --import-alias-prefix "${prefix}". Use a single-segment alias such as @ or ~.`,
    );
  }
  return trimmed;
}

function validateExplicitSourceDir(sourceDir: string): string {
  const normalized = sourceDir.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (normalized.includes("..") || normalized.includes("node_modules")) {
    throw new Error(
      `Invalid --source-dir "${sourceDir}". Use a project-local directory such as client or src.`,
    );
  }
  return normalized.length === 0 ? "." : normalized;
}

export function resolveInitProject(
  cwd: string,
  initOptions: InitOptions,
): ReturnType<typeof detectProject> {
  const detected = detectProject(cwd);
  if (detected.hasPathAlias) return detected;

  if (!initOptions.allowMissingAlias) {
    return detected;
  }

  const prefix = initOptions.importAliasPrefix;
  const sourceDir = initOptions.sourceDir;
  if (!prefix || !sourceDir) {
    throw new Error(
      "When no TypeScript or Vite source alias is detected, --allow-missing-alias requires " +
        "--import-alias-prefix and --source-dir so generated imports match your project layout.",
    );
  }

  return {
    ...detected,
    hasPathAlias: true,
    importAliasPrefix: validateImportAliasPrefix(prefix),
    sourceDir: validateExplicitSourceDir(sourceDir),
  };
}

export interface InitPlan {
  options: InitOptions;
  project: ReturnType<typeof detectProject>;
  componentsDir: string;
  libDir: string;
  stylesDir: string;
  hooksDir: string;
}

// Commander hands every init callback the same options object within one
// invocation, so detection and path derivation run once per `dgadd init`
// instead of once per phase. The WeakMap key is that options object, so nothing
// leaks between invocations in a long-lived process.
const planByOptions = new WeakMap<Record<string, unknown>, InitPlan>();

export function initPlan(cwd: string, opts: Record<string, unknown>): InitPlan {
  const cached = planByOptions.get(opts);
  if (cached) return cached;

  const options = parseInitOptions(opts);
  const plan: InitPlan = {
    options,
    ...derivePaths(cwd, options.componentsDir, resolveInitProject(cwd, options)),
  };
  planByOptions.set(opts, plan);
  return plan;
}

export function detectInitProject(cwd: string, opts: Record<string, unknown>) {
  assertForceRecoveryAllowed(cwd, opts, parseInitOptions(opts));
  const {
    options: initOptions,
    project,
    componentsDir,
    libDir,
    stylesDir,
    hooksDir,
  } = initPlan(cwd, opts);

  assertTailwindV4(project);
  assertInsideProject(cwd, componentsDir);
  assertInsideProject(cwd, libDir);
  assertInsideProject(cwd, stylesDir);
  assertInsideProject(cwd, hooksDir);

  if (!project.hasPathAlias && !initOptions.allowMissingAlias) {
    throw new Error(
      "dgadd requires a TypeScript or Vite alias that resolves to your source directory. " +
        "Configure it in your TypeScript and bundler config, then rerun init. " +
        "Use --allow-missing-alias only if your app already resolves source aliases another way.",
    );
  }

  return {
    display: [
      ["Package manager", project.packageManager],
      ["Tailwind", project.tailwindVersion],
      ["Source dir", `${project.sourceDir}/`],
      ["Path alias", project.hasPathAlias ? `${project.importAliasPrefix}/*` : "no"],
      ["RSC", project.rsc ? "yes" : "no"],
    ] satisfies Array<[label: string, value: string]>,
  };
}
