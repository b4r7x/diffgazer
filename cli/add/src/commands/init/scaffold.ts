import { existsSync, mkdirSync } from "node:fs";
import { writeFileSafe } from "@diffgazer/registry/cli";
import type { detectProject } from "../../utils/detect.js";
import { resolveProjectPath } from "../../utils/paths.js";

export type FileResult = { action: "created" | "skipped"; path: string };

export const UTILS_CONTENT = [
  `import { type ClassValue, clsx } from "clsx";`,
  `import { twMerge } from "tailwind-merge";`,
  ``,
  `export function cn(...inputs: ClassValue[]) {`,
  `  return twMerge(clsx(inputs));`,
  `}`,
  ``,
].join("\n");

export const INIT_DEPENDENCIES = ["class-variance-authority", "clsx", "tailwind-merge"];

export function writeFileResult(
  absolutePath: string,
  content: string,
  displayPath: string,
): FileResult {
  const result = writeFileSafe(absolutePath, content);
  return { action: result === "written" ? "created" : "skipped", path: displayPath };
}

export function createDirs(cwd: string, componentsDir: string, hooksDir: string): FileResult[] {
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

export function assertTailwindV4(
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
