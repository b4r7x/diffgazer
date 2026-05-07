import { existsSync, mkdirSync } from "node:fs";
import { detectProject } from "../utils/detect.js";
import { createInitCommand, writeFileSafe, installDepsWithSpinner, heading, warn, REGISTRY_ORIGIN } from "@diffgazer/registry/cli";
import { ctx, getRegistry, VERSION } from "../context.js";
import { resolveInstallPath, resolveProjectPath } from "../utils/paths.js";

type FileResult = { action: "created" | "skipped"; path: string };

function derivePaths(cwd: string, componentsDir: string) {
  const project = detectProject(cwd);
  const sourcePrefix = project.sourceDir === "." ? "" : `${project.sourceDir}/`;
  const requestedDir = componentsDir.replace(/\\/g, "/");
  const resolvedComponentsDir = requestedDir === "src/components/ui" && project.sourceDir !== "src"
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
    { action: compExists ? "skipped" : "created", path: componentsDir + "/" },
    { action: hookExists ? "skipped" : "created", path: hooksDir + "/" },
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

function componentCssContent(registry: ReturnType<typeof getRegistry>): string {
  const seen = new Set<string>();
  const chunks: string[] = [];

  for (const item of registry.items) {
    if (item.type === "registry:theme") continue;

    for (const file of item.files) {
      if (!file.path.endsWith(".css") || seen.has(file.path)) continue;
      seen.add(file.path);
      chunks.push(file.content.trimEnd());
    }
  }

  return chunks.filter(Boolean).join("\n\n");
}

function buildStylesContent(registry: ReturnType<typeof getRegistry>): string {
  const chunks = [registry.styles.trimEnd(), componentCssContent(registry)].filter(Boolean);
  return `${chunks.join("\n\n")}\n`;
}

export const initCommand = createInitCommand({
  configFileName: "diffgazer.json",
  loadConfig: ctx.config.loadConfig,
  extraOptions: [
    { flags: "--components-dir <path>", description: "Component install directory", default: "src/components/ui" },
    { flags: "--allow-missing-alias", description: "Initialize even when the app has no TypeScript/bundler source alias" },
  ],
  detectProject: (cwd, opts) => {
    const { project, componentsDir, libDir, stylesDir, hooksDir } = derivePaths(cwd, String(opts.componentsDir));

    resolveProjectPath(cwd, componentsDir);
    resolveProjectPath(cwd, libDir);
    resolveProjectPath(cwd, stylesDir);
    resolveProjectPath(cwd, hooksDir);

    if (!project.hasPathAlias && !opts.allowMissingAlias) {
      throw new Error(
        "dgadd requires a TypeScript or Vite alias that resolves to your source directory. "
        + "Configure it in your TypeScript and bundler config, then rerun init. "
        + "Use --allow-missing-alias only if your app already resolves source aliases another way.",
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
  createFiles: (cwd, opts) => {
    const { componentsDir, libDir, stylesDir, hooksDir } = derivePaths(cwd, String(opts.componentsDir));
    const registry = getRegistry();

    return [
      ...createDirs(cwd, componentsDir, hooksDir),
      writeFileResult(resolveInstallPath(cwd, libDir, "utils.ts"), UTILS_CONTENT, `${libDir}/utils.ts`),
      writeFileResult(resolveInstallPath(cwd, stylesDir, "theme.css"), registry.theme, `${stylesDir}/theme.css`),
      writeFileResult(resolveInstallPath(cwd, stylesDir, "styles.css"), buildStylesContent(registry), `${stylesDir}/styles.css`),
    ];
  },
  afterFiles: async (cwd) => {
    const project = detectProject(cwd);
    heading("Installing dependencies...");
    const deps = ["class-variance-authority", "clsx", "tailwind-merge"];
    const ok = await installDepsWithSpinner(project.packageManager, deps, cwd);
    if (!ok) warn("You can install them manually later.");
  },
  writeConfig: (cwd, opts) => {
    const { project, componentsDir, libDir, stylesDir, hooksDir } = derivePaths(cwd, String(opts.componentsDir));

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

    ctx.config.writeConfig(cwd, {
      $schema: `${REGISTRY_ORIGIN}/schema/diffgazer.json`,
      version: VERSION,
      aliases,
      componentsFsPath: componentsDir,
      libFsPath: libDir,
      hooksFsPath: hooksDir,
      rsc: project.rsc,
      tailwind: { css: `${stylesDir}/styles.css` },
    });
  },
  nextSteps: [
    "Add @import './styles/styles.css' to your main CSS file.",
    "Then add items with: dgadd add ui/button or dgadd add keys/navigation.",
  ],
});
