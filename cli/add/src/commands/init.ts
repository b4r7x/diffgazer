import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  createInitCommand,
  ensureWithinDir,
  heading,
  installDepsWithSpinner,
  PACKAGE_MANAGER_LOCKFILES,
  REGISTRY_ORIGIN,
  showSkippedDependencies,
  writeFileSafe,
} from "@diffgazer/registry/cli";
import { z } from "zod";
import {
  ctx,
  type DiffgazerAddConfig,
  DiffgazerAddConfigSchema,
  getRegistry,
  LEGACY_MANIFEST_KEY,
  resolveConfig,
  VERSION,
} from "../context.js";
import { buildStylesContent } from "../utils/css-chunks.js";
import { detectProject } from "../utils/detect.js";
import { withProjectMutationLock } from "../utils/mutation-lock.js";
import {
  assertInsideProject,
  normalizeManifestPath,
  normalizeProjectRelativePath,
  resolveInstallPath,
  resolveProjectPath,
} from "../utils/paths.js";

// Commander hands callbacks a loosely-typed options bag; validate the
// init-specific fields at the boundary instead of casting.
const InitOptionsSchema = z.looseObject({
  componentsDir: z.string().optional(),
  allowMissingAlias: z.boolean().optional(),
  resetManifest: z.boolean().optional(),
  importAliasPrefix: z.string().optional(),
  sourceDir: z.string().optional(),
});

type InitOptions = z.infer<typeof InitOptionsSchema>;

function parseInitOptions(opts: Record<string, unknown>): InitOptions {
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

type FileResult = { action: "created" | "skipped"; path: string };

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
  const withoutSourcePrefix = resolved.replace(new RegExp(`^${project.sourceDir}/`), "");
  return `${sourcePrefix}${withoutSourcePrefix}`;
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
  } catch {
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

function writeFileResult(absolutePath: string, content: string, displayPath: string): FileResult {
  const result = writeFileSafe(absolutePath, content);
  return { action: result === "written" ? "created" : "skipped", path: displayPath };
}

function createDirs(cwd: string, componentsDir: string, hooksDir: string): FileResult[] {
  const compPath = resolveProjectPath(cwd, componentsDir);
  const hookPath = resolveProjectPath(cwd, hooksDir);
  const compExists = existsSync(compPath);
  const hookExists = existsSync(hookPath);
  if (!compExists) mkdirSync(compPath, { recursive: true });
  if (!hookExists) mkdirSync(hookPath, { recursive: true });
  return [
    { action: compExists ? "skipped" : "created", path: `${componentsDir}/` },
    { action: hookExists ? "skipped" : "created", path: `${hooksDir}/` },
  ];
}

const UTILS_CONTENT = [
  `import { type ClassValue, clsx } from "clsx";`,
  `import { twMerge } from "tailwind-merge";`,
  ``,
  `export function cn(...inputs: ClassValue[]) {`,
  `  return twMerge(clsx(inputs));`,
  `}`,
  ``,
].join("\n");

const INIT_DEPENDENCIES = ["class-variance-authority", "clsx", "tailwind-merge"];

function tailwindInstallCommand(
  packageManager: ReturnType<typeof detectProject>["packageManager"],
): string {
  return packageManager === "npm"
    ? "npm install --save-dev tailwindcss@^4"
    : `${packageManager} add -D tailwindcss@^4`;
}

function isTailwindV4(version: string): boolean {
  const spec = version.trim().replace(/^workspace:/, "");

  if (/^(?:\^|~)?v?4(?:\.(?:\d+|x|\*)){0,2}(?:-[0-9A-Za-z.-]+)?$/.test(spec)) {
    return true;
  }

  if (/^>=\s*v?4(?:\.\d+){0,2}\s+<\s*v?5(?:\.0+){0,2}$/.test(spec)) {
    return true;
  }

  return /^v?4(?:\.\d+){1,2}\s+-\s+v?4(?:\.\d+){1,2}$/.test(spec);
}

function assertTailwindV4(
  project: ReturnType<typeof detectProject>,
): asserts project is ReturnType<typeof detectProject> & { tailwindVersion: string } {
  const installCommand = tailwindInstallCommand(project.packageManager);
  if (!project.tailwindVersion) {
    throw new Error(
      "Tailwind CSS v4 is required, but tailwindcss was not found in dependencies or " +
        `devDependencies. Install it with \`${installCommand}\`, then rerun \`dgadd init\`.`,
    );
  }
  if (!isTailwindV4(project.tailwindVersion)) {
    throw new Error(
      `Tailwind CSS v4 is required, but package.json declares tailwindcss ${JSON.stringify(project.tailwindVersion)}. ` +
        `Install it with \`${installCommand}\`, then rerun \`dgadd init\`.`,
    );
  }
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

function resolveInitProject(
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

interface InitPlan {
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

function initPlan(cwd: string, opts: Record<string, unknown>): InitPlan {
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
  assertForceRecoveryAllowed(cwd, opts);
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

const installedItemsSchema = DiffgazerAddConfigSchema.shape.installedItems;

const FORCE_PARSE_ERROR_MESSAGE =
  "Cannot re-initialize a malformed diffgazer.json with --force without also passing " +
  "--reset-manifest, because the installed-item ownership ledger cannot be recovered. " +
  "Fix the syntax error, delete diffgazer.json, or pass both --force and --reset-manifest " +
  "to discard the ledger and re-initialize.";

const FORCE_INVALID_LEDGER_MESSAGE =
  "diffgazer.json has an invalid installedItems ledger that cannot be preserved. " +
  "Pass --reset-manifest with --force to discard the ledger and re-initialize.";

function recoverInstalledItemsLedger(
  cwd: string,
): DiffgazerAddConfig["installedItems"] | undefined {
  const configPath = resolve(cwd, "diffgazer.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  const raw =
    record.installedItems === undefined ? record[LEGACY_MANIFEST_KEY] : record.installedItems;
  if (raw === undefined) {
    return undefined;
  }

  const result = installedItemsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(FORCE_INVALID_LEDGER_MESSAGE);
  }

  return result.data;
}

function resolveInstalledItemsForInit(
  cwd: string,
  initOptions: InitOptions,
): DiffgazerAddConfig["installedItems"] | undefined {
  if (initOptions.resetManifest) {
    return undefined;
  }

  const existing = ctx.config.loadConfig(cwd);
  if (existing.ok) {
    return existing.config.installedItems;
  }

  if (existing.error === "validation_error") {
    return recoverInstalledItemsLedger(cwd);
  }

  if (existing.error === "parse_error") {
    throw new Error(FORCE_PARSE_ERROR_MESSAGE);
  }

  return undefined;
}

function assertForceRecoveryAllowed(cwd: string, opts: Record<string, unknown>): void {
  const initOptions = parseInitOptions(opts);
  if (opts.force !== true || initOptions.resetManifest) {
    return;
  }

  const existing = ctx.config.loadConfig(cwd);
  if (!existing.ok && existing.error === "parse_error") {
    throw new Error(FORCE_PARSE_ERROR_MESSAGE);
  }

  if (!existing.ok && existing.error === "validation_error") {
    recoverInstalledItemsLedger(cwd);
  }
}

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

function validateReinitializeTopology(context: {
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

export const initCommand = createInitCommand({
  configFileName: "diffgazer.json",
  loadConfig: ctx.config.loadConfig,
  dependencies: INIT_DEPENDENCIES,
  onSkipInstall: (dependencies) => showSkippedDependencies(dependencies, "--skip-install"),
  validateReinitialize: validateReinitializeTopology,
  withLock: withProjectMutationLock,
  extraOptions: [
    {
      flags: "--components-dir <path>",
      description: "Component install directory (default: <source dir>/components/ui)",
    },
    {
      flags: "--allow-missing-alias",
      description: "Initialize even when the app has no TypeScript/bundler source alias",
    },
    {
      flags: "--import-alias-prefix <prefix>",
      description:
        "Import alias prefix to use with --allow-missing-alias when detection fails (for example @ or ~)",
    },
    {
      flags: "--source-dir <path>",
      description:
        "Source directory to use with --allow-missing-alias when detection fails (for example client or src)",
    },
    {
      flags: "--reset-manifest",
      description:
        "Recovery only: discard the installed-item ownership ledger, orphaning previously installed files",
    },
  ],
  detectProject: detectInitProject,
  plannedPaths: (cwd, opts) => buildInitPlannedPaths(cwd, opts),
  createFiles: (cwd, opts) => {
    const { componentsDir, libDir, stylesDir, hooksDir } = initPlan(cwd, opts);
    const registry = getRegistry();

    return [
      ...createDirs(cwd, componentsDir, hooksDir),
      writeFileResult(
        resolveInstallPath(cwd, libDir, "utils.ts"),
        UTILS_CONTENT,
        `${libDir}/utils.ts`,
      ),
      writeFileResult(
        resolveInstallPath(cwd, stylesDir, "theme.css"),
        registry.theme,
        `${stylesDir}/theme.css`,
      ),
      writeFileResult(
        resolveInstallPath(cwd, stylesDir, "styles.css"),
        buildStylesContent(registry),
        `${stylesDir}/styles.css`,
      ),
    ];
  },
  // Throw on install failure so the workflow rolls back the freshly created files
  // and config instead of leaving a written diffgazer.json with missing deps.
  afterFiles: async (cwd, opts, abortSignal) => {
    const { project } = initPlan(cwd, opts);
    heading("Installing dependencies...");
    const ok = await installDepsWithSpinner(
      project.packageManager,
      INIT_DEPENDENCIES,
      cwd,
      abortSignal,
    );
    if (!ok) {
      throw new Error(
        "Failed to install dependencies (class-variance-authority, clsx, tailwind-merge). " +
          "Re-run with --skip-install to write files without installing, then install them manually.",
      );
    }
  },
  writeConfig: (cwd, opts) => writeInitConfig(cwd, opts),
  nextSteps: [
    "Add @import './styles/styles.css' to your main CSS file.",
    "Then add items with: dgadd add ui/button or dgadd add keys/navigation.",
  ],
});
