import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { isEnoent, readTsConfigPaths } from "./fs.js";
import { PACKAGE_MANAGER_LOCKFILE_ENTRIES } from "./lockfiles.js";
import { toErrorMessage, warn } from "./terminal.js";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageJson {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return Object.fromEntries(entries);
}

function normalizePackageJson(value: unknown): PackageJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return {
    ...input,
    packageManager: typeof input.packageManager === "string" ? input.packageManager : undefined,
    dependencies: readStringRecord(input.dependencies),
    devDependencies: readStringRecord(input.devDependencies),
    peerDependencies: readStringRecord(input.peerDependencies),
  };
}

export function readPackageJson(cwd: string): PackageJson | null {
  try {
    return normalizePackageJson(JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8")));
  } catch (e) {
    if (!isEnoent(e)) warn(`Could not read package.json: ${toErrorMessage(e)}`);
    return null;
  }
}

function fromPackageManagerField(pkg: PackageJson | null): PackageManager | null {
  const field = typeof pkg?.packageManager === "string" ? pkg.packageManager.trim() : undefined;
  if (field?.startsWith("npm@")) return "npm";
  if (field?.startsWith("pnpm@")) return "pnpm";
  if (field?.startsWith("yarn@")) return "yarn";
  if (field?.startsWith("bun@")) return "bun";
  return null;
}

function fromUserAgent(): PackageManager | null {
  const agent = process.env.npm_config_user_agent;
  if (agent?.includes("pnpm")) return "pnpm";
  if (agent?.includes("yarn")) return "yarn";
  if (agent?.includes("bun")) return "bun";
  return null;
}

function fromLockfile(cwd: string): PackageManager | null {
  const found = PACKAGE_MANAGER_LOCKFILE_ENTRIES.map(({ file, pm }) => ({
    path: resolve(cwd, file),
    pm,
  })).filter(({ path }) => existsSync(path));

  if (found.length <= 1) return found[0]?.pm ?? null;

  const uniquePms = [...new Set(found.map((f) => f.pm))];
  if (uniquePms.length > 1) {
    warn(
      `Multiple lockfiles detected (${uniquePms.join(", ")}). Using the most recently modified.`,
    );
  }
  const mtimes = new Map(found.map((f) => [f.path, statSync(f.path).mtimeMs]));
  found.sort((a, b) => (mtimes.get(b.path) ?? 0) - (mtimes.get(a.path) ?? 0));
  return found[0]?.pm ?? null;
}

export function detectPackageManager(cwd: string, pkg?: PackageJson | null): PackageManager {
  const pkgJson = pkg ?? readPackageJson(cwd);
  const declared = fromPackageManagerField(pkgJson);
  const lockfile = fromLockfile(cwd);
  const userAgent = fromUserAgent();

  if (declared && userAgent && declared !== userAgent) {
    warn(
      `Package manager mismatch: package.json declares ${declared}, but current executor looks like ${userAgent}. Using ${declared}.`,
    );
  } else if (!declared && lockfile && userAgent && lockfile !== userAgent) {
    warn(
      `Package manager mismatch: lockfile suggests ${lockfile}, but current executor looks like ${userAgent}. Using ${lockfile}.`,
    );
  }

  return declared ?? lockfile ?? userAgent ?? "npm";
}

export function readPackageVersion(importMetaUrl: string, relativePath: string): string {
  const req = createRequire(importMetaUrl);
  return (req(relativePath) as { version: string }).version;
}

export function detectSourceDir(cwd: string): string {
  const paths = readTsConfigPaths(cwd);
  const mapping = paths?.["@/*"];
  if (Array.isArray(mapping)) {
    for (const entry of mapping) {
      const normalized = entry.replace(/\\/g, "/").replace(/^\.\//, "");
      if (normalized === "*") return ".";
      const match = normalized.match(/^([^*]+)\*/);
      if (match?.[1]) {
        return match[1].replace(/\/$/, "");
      }
    }
  }

  return existsSync(resolve(cwd, "src")) ? "src" : ".";
}
