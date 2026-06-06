import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve, win32 } from "node:path";

export function cleanDir(dir: string, ext: string): void {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (f.endsWith(ext)) rmSync(resolve(dir, f));
  }
}

export function relativePath(base: string, filePath: string): string {
  return filePath.startsWith(`${base}/`) ? filePath.slice(base.length + 1) : filePath;
}

export function ensureExists(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at "${path}"`);
  }
}

export function isRelativeSubpath(path: string): boolean {
  if (path.length === 0) return false;
  if (isAbsolute(path) || win32.isAbsolute(path)) return false;
  return !path.split(/[\\/]+/).includes("..");
}

/** Plain relative-prefix containment: is `target` at or inside `base`? */
export function isWithinDir(target: string, base: string): boolean {
  const rel = relative(resolve(base), resolve(target));
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export function resolveInside(baseDir: string, relPath: string, label: string): string {
  if (!isRelativeSubpath(relPath)) {
    throw new Error(`${label} must be a relative path inside "${baseDir}": ${relPath}`);
  }

  const target = resolve(baseDir, relPath);
  if (isWithinDir(target, baseDir)) {
    return target;
  }

  throw new Error(`${label} escapes "${baseDir}": ${relPath}`);
}

export function resetDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  try {
    mkdirSync(path, { recursive: true });
  } catch (error) {
    throw new Error(
      `resetDir removed "${path}" but failed to recreate it; the directory no longer exists.`,
      { cause: error },
    );
  }
}

export function collectAllFiles(rootDir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(rootDir)) {
    const fullPath = resolve(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectAllFiles(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

export function collectJsonFiles(rootDir: string): string[] {
  return collectAllFiles(rootDir).filter((f) => f.endsWith(".json"));
}
