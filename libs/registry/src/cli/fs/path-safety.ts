import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isWithinDir } from "../../utils/fs.js";

export function isEnoent(e: unknown): boolean {
  if (!(e instanceof Error) || !("code" in e)) return false;
  const err: Error & { code: unknown } = e;
  return err.code === "ENOENT";
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export function ensureWithinDir(targetPath: string, baseDir: string): void {
  const resolvedTarget = resolve(targetPath);
  const resolvedBase = resolve(baseDir);
  if (!isWithinDir(resolvedTarget, resolvedBase)) {
    throw new Error(`Path traversal detected: "${targetPath}" escapes "${baseDir}"`);
  }

  ensureRealPathWithinDir(resolvedTarget, resolvedBase);
}

export function ensureWithinAnyDir(targetPath: string, baseDirs: string[]): void {
  const resolvedTarget = resolve(targetPath);
  for (const dir of baseDirs) {
    const resolvedBase = resolve(dir);
    if (
      isWithinDir(resolvedTarget, resolvedBase) &&
      isRealPathWithinDir(resolvedTarget, resolvedBase)
    )
      return;
  }
  throw new Error(
    `Path traversal detected: "${targetPath}" escapes all allowed directories: ${baseDirs.map((d) => `"${d}"`).join(", ")}`,
  );
}

export function realpathExisting(path: string): string | null {
  try {
    return realpathSync.native(path);
  } catch (e) {
    if (isEnoent(e)) return null;
    throw e;
  }
}

function nearestExistingRealpath(path: string): string | null {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  try {
    return realpathSync.native(current);
  } catch {
    return null;
  }
}

function isRealPathWithinDir(targetPath: string, baseDir: string): boolean {
  const realBase =
    realpathExisting(baseDir) ?? nearestExistingRealpath(baseDir) ?? resolve(baseDir);
  const realTarget =
    realpathExisting(targetPath) ??
    nearestExistingRealpath(dirname(targetPath)) ??
    resolve(dirname(targetPath));
  return isWithinDir(realTarget, realBase);
}

const SYMLINK_TRAVERSAL_CODE = "ERR_PATH_TRAVERSAL_SYMLINK";

/**
 * True for the `ensureWithinDir` failure that means the path is lexically inside
 * the base directory but escapes it through a symlink. Callers that rewrite a
 * plain containment failure into a usage hint must re-throw this one instead.
 */
export function isSymlinkTraversalError(error: unknown): boolean {
  return hasErrorCode(error, SYMLINK_TRAVERSAL_CODE);
}

function ensureRealPathWithinDir(targetPath: string, baseDir: string): void {
  if (isRealPathWithinDir(targetPath, baseDir)) return;
  throw Object.assign(
    new Error(
      `Path traversal detected: "${targetPath}" escapes "${baseDir}" through a symlink or realpath.`,
    ),
    { code: SYMLINK_TRAVERSAL_CODE },
  );
}
