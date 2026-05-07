import { isAbsolute, relative, resolve } from "node:path";
import { ensureWithinDir } from "@diffgazer/registry/cli";

export function toPosixPath(path: string): string {
  return path.split(/[\\/]+/).filter(Boolean).join("/");
}

export function normalizeManifestPath(cwd: string, absolutePath: string): string {
  const rel = relative(cwd, absolutePath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Manifest path "${absolutePath}" escapes project root "${cwd}".`);
  }
  return toPosixPath(rel);
}

export function resolveProjectPath(cwd: string, relativePath: string): string {
  const normalizedPath = toPosixPath(relativePath);
  const isWindowsAbsolute = /^[a-zA-Z]:\//.test(normalizedPath) || normalizedPath.startsWith("//");
  if (isAbsolute(relativePath) || isAbsolute(normalizedPath) || isWindowsAbsolute) {
    throw new Error(`Project paths must be relative, received "${relativePath}".`);
  }

  const target = resolve(cwd, normalizedPath);
  ensureWithinDir(target, cwd);
  return target;
}

export function resolveInstallPath(cwd: string, installDir: string, relativePath: string): string {
  const targetRoot = resolveProjectPath(cwd, installDir);
  const targetPath = resolve(targetRoot, relativePath);
  ensureWithinDir(targetPath, targetRoot);
  return targetPath;
}
