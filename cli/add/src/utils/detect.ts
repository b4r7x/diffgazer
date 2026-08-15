import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  detectPackageManager,
  detectSourceDir,
  type PackageJson,
  type PackageManager,
  readPackageJson,
  readTsConfigPaths,
  warn,
} from "@diffgazer/registry/cli";
import {
  pickSourceAlias,
  sourceDirFromTarget,
  typescriptPathPrefixFromKey,
} from "./detect/source-alias.js";
import { detectViteAlias } from "./detect/vite-alias.js";

function dependencyVersionSpec(pkg: PackageJson | null, packageName: string): string | null {
  if (!pkg) return null;
  const dependencyVersion = pkg.dependencies?.[packageName];
  if (typeof dependencyVersion === "string") return dependencyVersion;
  const devDependencyVersion = pkg.devDependencies?.[packageName];
  return typeof devDependencyVersion === "string" ? devDependencyVersion : null;
}

function isAncestorNodeModulesPath(cwd: string, target: string): boolean {
  let directory = realpathSync(cwd);
  while (true) {
    const relativePath = relative(resolve(directory, "node_modules"), target);
    if (
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath)
    ) {
      return true;
    }
    const parent = dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
}

function resolveInstalledPackageVersion(cwd: string, packageName: string): string | null {
  try {
    const req = createRequire(resolve(realpathSync(cwd), "package.json"));
    const packageJsonPath = req.resolve(`${packageName}/package.json`);
    if (!isAncestorNodeModulesPath(cwd, packageJsonPath)) return null;
    const installed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    if (typeof installed !== "object" || installed === null || !("version" in installed)) {
      return null;
    }
    return typeof installed.version === "string" ? installed.version : null;
  } catch {
    return null;
  }
}

function unquoteYamlScalar(value: string): string {
  const trimmed = value.replace(/\s+#.*$/, "").trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseYamlEntry(line: string) {
  const match = line.match(/^( *)(["']?)([^"'#:]+)\2:\s*(.*?)\s*$/);
  const [, whitespace, , rawKey, rawValue] = match ?? [];
  if (whitespace === undefined || rawKey === undefined || rawValue === undefined) return null;
  return {
    indent: whitespace.length,
    key: rawKey.trim(),
    value: unquoteYamlScalar(rawValue),
  };
}

function parseUniqueYamlSection(source: string, sectionName: string) {
  const lines = source.split(/\r?\n/);
  const sections = lines
    .map((line, index) => ({ entry: parseYamlEntry(line), index }))
    .filter(({ entry }) => entry?.indent === 0 && entry.key === sectionName);
  if (sections.length !== 1 || sections[0]?.entry?.value !== "") return null;

  const section = sections[0];
  const entries = [];
  for (const line of lines.slice(section.index + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (line.length === trimmed.length) break;

    const entry = parseYamlEntry(line);
    if (!entry) return null;
    entries.push(entry);
  }
  return entries;
}

function resolveCatalogVersion(cwd: string, spec: string, packageName: string): string | null {
  let directory = resolve(cwd);
  let workspacePath: string | null = null;
  while (workspacePath === null) {
    const candidate = resolve(directory, "pnpm-workspace.yaml");
    if (existsSync(candidate)) {
      workspacePath = candidate;
      break;
    }
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }

  const catalogName = spec.slice("catalog:".length);
  const sectionEntries = parseUniqueYamlSection(
    readFileSync(workspacePath, "utf-8"),
    catalogName ? "catalogs" : "catalog",
  );
  const sectionChildIndent = sectionEntries?.[0]?.indent;
  if (!sectionEntries || sectionChildIndent === undefined) return null;

  if (!catalogName) {
    const packages = sectionEntries.filter((entry) => entry.key === packageName);
    const pkg = packages[0];
    return packages.length === 1 && pkg?.indent === sectionChildIndent && pkg.value
      ? pkg.value
      : null;
  }

  const catalogs = sectionEntries.filter((entry) => entry.key === catalogName);
  const catalog = catalogs[0];
  if (
    catalogs.length !== 1 ||
    !catalog ||
    catalog.indent !== sectionChildIndent ||
    catalog.value !== ""
  ) {
    return null;
  }

  const catalogIndex = sectionEntries.indexOf(catalog);
  const catalogEndOffset = sectionEntries
    .slice(catalogIndex + 1)
    .findIndex((entry) => entry.indent <= catalog.indent);
  const catalogBlock = sectionEntries.slice(
    catalogIndex + 1,
    catalogEndOffset === -1 ? undefined : catalogIndex + 1 + catalogEndOffset,
  );
  const catalogChildIndent = catalogBlock[0]?.indent;
  if (catalogChildIndent === undefined) return null;

  const packages = catalogBlock.filter((entry) => entry.key === packageName);
  const pkg = packages[0];
  return packages.length === 1 && pkg?.indent === catalogChildIndent && pkg.value
    ? pkg.value
    : null;
}

function resolveDependencyVersion(cwd: string, spec: string, packageName: string): string {
  const trimmed = spec.trim();
  const installed = resolveInstalledPackageVersion(cwd, packageName);
  if (installed) return installed;
  if (trimmed.startsWith("catalog:")) {
    return resolveCatalogVersion(cwd, trimmed, packageName) ?? trimmed;
  }
  return trimmed;
}

function detectTailwindVersion(cwd: string, pkg: PackageJson | null): string | null {
  const spec = dependencyVersionSpec(pkg, "tailwindcss");
  if (!spec) return null;
  return resolveDependencyVersion(cwd, spec, "tailwindcss");
}

function detectTypeScriptAlias(cwd: string) {
  const paths = readTsConfigPaths(cwd);
  if (!paths) return null;

  const aliases: Array<{ importPrefix: string; sourceDir: string }> = [];
  for (const [key, targets] of Object.entries(paths)) {
    const importPrefix = typescriptPathPrefixFromKey(key);
    if (!importPrefix) continue;

    for (const target of targets) {
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
  const nextSpec = dependencyVersionSpec(pkg, "next");
  if (nextSpec === null) return false;
  const nextVersion = resolveDependencyVersion(cwd, nextSpec, "next");
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
interface ProjectInfo {
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
    tailwindVersion: detectTailwindVersion(cwd, pkg),
    hasPathAlias: sourceAlias !== null,
    importAliasPrefix: sourceAlias?.importPrefix ?? "@",
    rsc: detectRsc(cwd, pkg),
  };
}
