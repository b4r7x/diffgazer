import { posix, relative, resolve, win32 } from "node:path";
import { ensureWithinDir } from "@diffgazer/registry/cli";

/**
 * Joins a path's segments with "/", dropping empty ones — so leading and
 * trailing separators are stripped. Every project path the CLI records is
 * relative, which is what the name says. Not interchangeable with
 * `@diffgazer/registry`'s `toPosixPath`, which preserves them.
 */
export function toRelativePosixSegments(path: string): string {
  return path
    .split(/[\\/]+/)
    .filter(Boolean)
    .join("/");
}

export function normalizeProjectRelativePath(path: string): string {
  if (posix.isAbsolute(path) || win32.isAbsolute(path)) {
    throw new Error(`Project paths must be relative, received "${path}".`);
  }
  return toRelativePosixSegments(path);
}

export function normalizeManifestPath(cwd: string, absolutePath: string): string {
  ensureWithinDir(absolutePath, cwd);
  return toRelativePosixSegments(relative(cwd, absolutePath));
}

export function resolveProjectPath(cwd: string, relativePath: string): string {
  const normalizedPath = normalizeProjectRelativePath(relativePath);
  const target = resolve(cwd, normalizedPath);
  ensureWithinDir(target, cwd);
  return target;
}

/**
 * Fail-fast assertion that a configured relative path resolves inside the project.
 * Use at command entry points so traversal/abs-path config errors throw before any IO.
 */
export function assertInsideProject(cwd: string, relativePath: string): void {
  resolveProjectPath(cwd, relativePath);
}

export function resolveInstallPath(cwd: string, installDir: string, relativePath: string): string {
  const targetRoot = resolveProjectPath(cwd, installDir);
  const targetPath = resolve(targetRoot, relativePath);
  ensureWithinDir(targetPath, targetRoot);
  return targetPath;
}
