import { existsSync, readFileSync } from "node:fs";
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

function detectTailwindVersion(pkg: PackageJson | null): string | null {
  if (!pkg) return null;
  return pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss || null;
}

interface SourceAlias {
  importPrefix: string;
  sourceDir: string;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function sourceDirFromTarget(target: string): string | null {
  const normalized = normalizePath(target.replace(/\*$/, ""));
  if (!normalized || normalized === ".") return ".";
  if (normalized.includes("node_modules")) return null;
  return normalized === "src" || normalized === "app" ? normalized : null;
}

function aliasPrefixFromKey(key: string): string | null {
  if (key === "*" || key.length === 0) return null;
  return key.endsWith("/*") ? key.slice(0, -2) : key;
}

function pickSourceAlias(aliases: SourceAlias[]): SourceAlias | null {
  if (aliases.length === 0) return null;
  const [firstAlias] = aliases;
  return (
    aliases.find((alias) => alias.importPrefix === "@") ??
    aliases.find((alias) => alias.importPrefix === "~") ??
    firstAlias ??
    null
  );
}

function detectTypeScriptAlias(cwd: string): SourceAlias | null {
  const paths = readTsConfigPaths(cwd);
  if (!paths) return null;

  const aliases: SourceAlias[] = [];
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

function detectViteAlias(cwd: string): SourceAlias | null {
  for (const file of ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"]) {
    const configPath = resolve(cwd, file);
    if (!existsSync(configPath)) continue;

    const content = readFileSync(configPath, "utf-8");
    const aliases: SourceAlias[] = [];
    const targetExpression = String.raw`(?:(?:path\.)?resolve\([^,]+,\s*["']([^"']+)["']\)|fileURLToPath\(\s*new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)\s*\)|new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)\.pathname|["']([^"']+)["'])`;
    const objectEntry = new RegExp(String.raw`["']([^"']+)["']\s*:\s*${targetExpression}`, "g");
    const arrayEntry = new RegExp(
      String.raw`find:\s*["']([^"']+)["'][\s\S]{0,160}?replacement:\s*${targetExpression}`,
      "g",
    );

    for (const regex of [objectEntry, arrayEntry]) {
      for (const match of content.matchAll(regex)) {
        const importPrefix = aliasPrefixFromKey(match[1] ?? "");
        const target = match.slice(2).find((value) => value !== undefined) ?? "";
        const sourceDir = sourceDirFromTarget(target);
        if (importPrefix && sourceDir) aliases.push({ importPrefix, sourceDir });
      }
    }

    const alias = pickSourceAlias(aliases);
    if (alias) return alias;
  }

  return null;
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
  return {
    packageManager: detectPackageManager(cwd, pkg),
    sourceDir: sourceAlias?.sourceDir ?? detectSourceDir(cwd),
    tailwindVersion: detectTailwindVersion(pkg),
    hasPathAlias: sourceAlias !== null,
    importAliasPrefix: sourceAlias?.importPrefix ?? "@",
    rsc: detectRsc(cwd, pkg),
  };
}
