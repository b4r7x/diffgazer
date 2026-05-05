import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { detectProject } from "../utils/detect.js";
import { createInitCommand, writeFileSafe, ensureWithinDir, installDepsWithSpinner, heading, warn, REGISTRY_ORIGIN } from "@diffgazer/registry/cli";
import { ctx, getRegistry, VERSION } from "../context.js";

type FileResult = { action: "created" | "skipped"; path: string };

function derivePaths(cwd: string, componentsDir: string) {
  const project = detectProject(cwd);
  return {
    project,
    componentsDir,
    libDir: `${project.sourceDir}/lib`,
    stylesDir: `${project.sourceDir}/styles`,
    hooksDir: `${project.sourceDir}/hooks`,
  };
}

function writeFileResult(absolutePath: string, content: string, displayPath: string): FileResult {
  const result = writeFileSafe(absolutePath, content);
  return { action: result === "written" ? "created" : "skipped", path: displayPath };
}

function createDirs(cwd: string, componentsDir: string, hooksDir: string): FileResult[] {
  const compPath = resolve(cwd, componentsDir);
  const hookPath = resolve(cwd, hooksDir);
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

export const initCommand = createInitCommand({
  configFileName: "diffgazer.json",
  loadConfig: ctx.config.loadConfig,
  extraOptions: [
    { flags: "--components-dir <path>", description: "Component install directory", default: "src/components/ui" },
  ],
  detectProject: (cwd, opts) => {
    const { project, componentsDir, libDir, stylesDir, hooksDir } = derivePaths(cwd, String(opts.componentsDir));

    ensureWithinDir(resolve(cwd, componentsDir), cwd);
    ensureWithinDir(resolve(cwd, libDir), cwd);
    ensureWithinDir(resolve(cwd, stylesDir), cwd);
    ensureWithinDir(resolve(cwd, hooksDir), cwd);

    return {
      display: [
        ["Package manager", project.packageManager],
        ["Tailwind", project.tailwindVersion || "not found"],
        ["Source dir", `${project.sourceDir}/`],
        ["Path alias @/*", project.hasPathAlias ? "yes" : "no"],
        ["RSC", project.rsc ? "yes" : "no"],
      ],
    };
  },
  createFiles: (cwd, opts) => {
    const { componentsDir, libDir, stylesDir, hooksDir } = derivePaths(cwd, String(opts.componentsDir));
    const registry = getRegistry();

    return [
      ...createDirs(cwd, componentsDir, hooksDir),
      writeFileResult(resolve(cwd, libDir, "utils.ts"), UTILS_CONTENT, `${libDir}/utils.ts`),
      writeFileResult(resolve(cwd, stylesDir, "theme.css"), registry.theme, `${stylesDir}/theme.css`),
      writeFileResult(resolve(cwd, stylesDir, "styles.css"), registry.styles, `${stylesDir}/styles.css`),
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

    const stripSource = (p: string) => p.replace(/^src\//, "");
    const aliases = {
      components: `@/${stripSource(componentsDir)}`,
      utils: `@/${stripSource(libDir)}/utils`,
      lib: `@/${stripSource(libDir)}`,
      hooks: "@/hooks",
    };

    ctx.config.writeConfig(cwd, {
      $schema: `${REGISTRY_ORIGIN}/schema/diffgazer.json`,
      version: VERSION,
      aliases,
      componentsFsPath: componentsDir,
      libFsPath: libDir,
      hooksFsPath: hooksDir,
      rsc: project.rsc,
      tailwind: { css: `${stylesDir}/theme.css` },
    });
  },
  nextSteps: [
    "Add @import './styles/styles.css' to your main CSS file.",
    "Then add items with: dgadd add ui/button or dgadd add keys/navigation.",
  ],
});
