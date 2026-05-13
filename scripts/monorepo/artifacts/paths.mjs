import { isAbsolute, relative, resolve, win32 } from "node:path";

export function toPosixPath(path) {
  return path.split(/[\\/]+/).join("/");
}

export function isRelativeSubpath(path) {
  if (typeof path !== "string" || path.length === 0) return false;
  if (isAbsolute(path) || win32.isAbsolute(path)) return false;
  return !toPosixPath(path).split("/").includes("..");
}

// These scripts run under plain Node before TypeScript packages are built.
export function resolveInside(baseDir, relPath, label) {
  if (typeof relPath !== "string" || relPath.length === 0) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  if (isAbsolute(relPath) || win32.isAbsolute(relPath)) {
    throw new Error(`${label} must be relative: ${relPath}`);
  }

  const baseAbs = resolve(baseDir);
  const target = resolve(baseAbs, relPath);
  const relativePath = relative(baseAbs, target);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return target;
  }

  throw new Error(`${label} escapes ${baseAbs}: ${relPath}`);
}
