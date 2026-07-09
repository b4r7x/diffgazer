import { existsSync, mkdirSync } from "node:fs";
import {
  createInitCommand,
  heading,
  installDepsWithSpinner,
  REGISTRY_ORIGIN,
  writeFileSafe,
} from "@diffgazer/registry/cli";
import { z } from "zod";
import { ctx, getRegistry, VERSION } from "../context.js";
import { detectProject } from "../utils/detect.js";
import { assertInsideProject, resolveInstallPath, resolveProjectPath } from "../utils/paths.js";

// Commander hands callbacks a loosely-typed options bag; validate the
// init-specific fields at the boundary instead of casting.
const InitOptionsSchema = z
  .object({
    componentsDir: z.string().default("src/components/ui"),
    allowMissingAlias: z.boolean().optional(),
    resetManifest: z.boolean().optional(),
  })
  .passthrough();

export type InitOptions = z.infer<typeof InitOptionsSchema>;

function parseInitOptions(opts: Record<string, unknown>): InitOptions {
  return InitOptionsSchema.parse(opts);
}

// Declared as planned paths so an install during init that creates or mutates a
// lockfile is rolled back on a later writeConfig failure. Keep in sync with the
// lockfile table in `@diffgazer/registry/cli` detect.ts.
export const KNOWN_LOCKFILES = [
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
  "package-lock.json",
] as const;

// Every path init may create, write, or touch — including package.json and the
// lockfiles — so a writeConfig failure after afterFiles rolls them back.
export function buildInitPlannedPaths(cwd: string, opts: Record<string, unknown>): string[] {
  const { componentsDir, libDir, stylesDir, hooksDir } = derivePaths(
    cwd,
    parseInitOptions(opts).componentsDir,
  );
  return [
    `${componentsDir}/`,
    `${hooksDir}/`,
    `${libDir}/utils.ts`,
    `${stylesDir}/theme.css`,
    `${stylesDir}/styles.css`,
    "package.json",
    ...KNOWN_LOCKFILES,
  ];
}

type FileResult = { action: "created" | "skipped"; path: string };

function derivePaths(cwd: string, componentsDir: string) {
  const project = detectProject(cwd);
  const sourcePrefix = project.sourceDir === "." ? "" : `${project.sourceDir}/`;
  const requestedDir = componentsDir.replace(/\\/g, "/");
  const resolvedComponentsDir =
    requestedDir === "src/components/ui" && project.sourceDir !== "src"
      ? `${sourcePrefix}components/ui`
      : requestedDir;
  return {
    project,
    componentsDir: resolvedComponentsDir,
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

export function buildStylesContent(registry: ReturnType<typeof getRegistry>): string {
  return `${registry.styles.trimEnd()}\n`;
}

// init --force re-derives config choices but carries installedComponents across
// so add/diff/remove do not orphan already-installed files; only --reset-manifest
// drops the ledger.
export function writeInitConfig(cwd: string, opts: Record<string, unknown>): void {
  const initOptions = parseInitOptions(opts);
  const { project, componentsDir, libDir, stylesDir, hooksDir } = derivePaths(
    cwd,
    initOptions.componentsDir,
  );

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

  const existing = ctx.config.loadConfig(cwd);
  const installedComponents =
    initOptions.resetManifest || !existing.ok ? undefined : existing.config.installedComponents;

  ctx.config.writeConfig(cwd, {
    $schema: `${REGISTRY_ORIGIN}/schema/diffgazer.json`,
    version: VERSION,
    aliases,
    componentsFsPath: componentsDir,
    libFsPath: libDir,
    hooksFsPath: hooksDir,
    rsc: project.rsc,
    tailwind: { css: `${stylesDir}/styles.css` },
    ...(installedComponents ? { installedComponents } : {}),
  });
}

export const initCommand = createInitCommand({
  configFileName: "diffgazer.json",
  loadConfig: ctx.config.loadConfig,
  extraOptions: [
    {
      flags: "--components-dir <path>",
      description: "Component install directory",
      default: "src/components/ui",
    },
    {
      flags: "--allow-missing-alias",
      description: "Initialize even when the app has no TypeScript/bundler source alias",
    },
    {
      flags: "--reset-manifest",
      description:
        "Discard the tracked installed-component ownership ledger instead of preserving it (orphans previously installed files)",
    },
  ],
  detectProject: (cwd, opts) => {
    const initOptions = parseInitOptions(opts);
    const { project, componentsDir, libDir, stylesDir, hooksDir } = derivePaths(
      cwd,
      initOptions.componentsDir,
    );

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
        ["Tailwind", project.tailwindVersion || "not found"],
        ["Source dir", `${project.sourceDir}/`],
        ["Path alias", project.hasPathAlias ? `${project.importAliasPrefix}/*` : "no"],
        ["RSC", project.rsc ? "yes" : "no"],
      ],
    };
  },
  plannedPaths: (cwd, opts) => buildInitPlannedPaths(cwd, opts),
  createFiles: (cwd, opts) => {
    const { componentsDir, libDir, stylesDir, hooksDir } = derivePaths(
      cwd,
      parseInitOptions(opts).componentsDir,
    );
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
  afterFiles: async (cwd) => {
    const project = detectProject(cwd);
    heading("Installing dependencies...");
    const deps = ["class-variance-authority", "clsx", "tailwind-merge"];
    const ok = await installDepsWithSpinner(project.packageManager, deps, cwd);
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
