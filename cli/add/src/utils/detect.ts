import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  type PackageManager,
  type PackageJson,
  detectPackageManager,
  readPackageJson,
  detectSourceDir,
  readTsConfigPaths,
  warn,
} from "@diffgazer/registry/cli";

function detectTailwindVersion(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  return pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss || null;
}

function detectTypeScriptAlias(cwd: string): boolean {
  const paths = readTsConfigPaths(cwd);
  return paths !== null && "@/*" in paths;
}

function detectRsc(cwd: string, pkg: PackageJson | null): boolean {
  if (!pkg) return false;
  const hasAppDir = existsSync(resolve(cwd, "app")) || existsSync(resolve(cwd, "src/app"));
  if (!hasAppDir) return false;
  const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next;
  if (!nextVersion) return false;
  const match = nextVersion.match(/(\d+)\.(\d+)/);
  if (!match) {
    warn(`Could not parse Next.js version "${nextVersion}" for RSC detection`);
    return false;
  }
  const [, major, minor] = match;
  const maj = parseInt(major!, 10);
  const min = parseInt(minor!, 10);
  return maj > 13 || (maj === 13 && min >= 4);
}

/** CLI project detection info. @see @diffgazer/core/schemas/config (ProjectInfoSchema) for the server-side project info with trust config. */
export interface ProjectInfo {
  packageManager: PackageManager;
  sourceDir: string;
  tailwindVersion: string | null;
  hasPathAlias: boolean;
  rsc: boolean;
}

export function detectProject(cwd: string): ProjectInfo {
  const pkg = readPackageJson(cwd);
  return {
    packageManager: detectPackageManager(cwd, pkg),
    sourceDir: detectSourceDir(cwd),
    tailwindVersion: detectTailwindVersion(pkg),
    hasPathAlias: detectTypeScriptAlias(cwd),
    rsc: detectRsc(cwd, pkg),
  };
}
