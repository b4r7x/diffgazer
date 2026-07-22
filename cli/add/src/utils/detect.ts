import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  detectPackageManager,
  detectSourceDir,
  type PackageJson,
  type PackageManager,
  readPackageJson,
  readTsConfigPaths,
  warn,
} from "@diffgazer/registry/cli";
import { aliasPrefixFromKey, pickSourceAlias, sourceDirFromTarget } from "./detect/source-alias.js";
import { detectViteAlias } from "./detect/vite-alias.js";

function detectTailwindVersion(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  const dependencyVersion = pkg.dependencies?.tailwindcss;
  if (typeof dependencyVersion === "string") return dependencyVersion;
  const devDependencyVersion = pkg.devDependencies?.tailwindcss;
  return typeof devDependencyVersion === "string" ? devDependencyVersion : null;
}

function detectTypeScriptAlias(cwd: string) {
  const paths = readTsConfigPaths(cwd);
  if (!paths) return null;

  const aliases: Array<{ importPrefix: string; sourceDir: string }> = [];
  for (const [key, targets] of Object.entries(paths)) {
    const importPrefix = aliasPrefixFromKey(key);
    if (!importPrefix || !Array.isArray(targets)) continue;

    for (const target of targets) {
      if (typeof target !== "string") continue;
      const sourceDir = sourceDirFromTarget(target);
      if (sourceDir) aliases.push({ importPrefix, sourceDir });
    }
  }

  return pickSourceAlias(aliases);
}

function detectRsc(cwd: string, pkg: PackageJson | null): boolean {
  if (!pkg) return false;
  const hasAppDir = existsSync(resolve(cwd, "app")) || existsSync(resolve(cwd, "src/app"));
  if (!hasAppDir) return false;
  const dependencyVersion = pkg.dependencies?.next;
  const devDependencyVersion = pkg.devDependencies?.next;
  let nextVersion: string | null = null;
  if (typeof dependencyVersion === "string") nextVersion = dependencyVersion;
  else if (typeof devDependencyVersion === "string") nextVersion = devDependencyVersion;
  if (nextVersion === null) return false;
  const match = nextVersion.match(/(\d+)\.(\d+)/);
  if (!match) {
    warn(`Could not parse Next.js version "${nextVersion}" for RSC detection`);
    return false;
  }
  const [, major, minor] = match;
  if (!major || !minor) return false;

  const maj = parseInt(major, 10);
  const min = parseInt(minor, 10);
  return maj > 13 || (maj === 13 && min >= 4);
}

/** CLI project detection info. @see @diffgazer/core/schemas/config (ProjectInfoSchema) for the server-side project info with trust config. */
export interface ProjectInfo {
  packageManager: PackageManager;
  sourceDir: string;
  tailwindVersion: string | null;
  hasPathAlias: boolean;
  importAliasPrefix: string;
  rsc: boolean;
}

export function detectProject(cwd: string): ProjectInfo {
  const pkg = readPackageJson(cwd);
  const sourceAlias = detectTypeScriptAlias(cwd) ?? detectViteAlias(cwd);
  const packageManagerPackageJson = pkg
    ? {
        ...pkg,
        packageManager: typeof pkg.packageManager === "string" ? pkg.packageManager : undefined,
      }
    : null;
  return {
    packageManager: detectPackageManager(cwd, packageManagerPackageJson),
    sourceDir: sourceAlias?.sourceDir ?? detectSourceDir(cwd),
    tailwindVersion: detectTailwindVersion(pkg),
    hasPathAlias: sourceAlias !== null,
    importAliasPrefix: sourceAlias?.importPrefix ?? "@",
    rsc: detectRsc(cwd, pkg),
  };
}
