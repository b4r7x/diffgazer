import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

export function cleanEmptyDirs(dirs: string[]): void {
  for (const dir of dirs) {
    tryRemoveIfEmpty(dir);
  }
}

function tryRemoveIfEmpty(dir: string): void {
  try {
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
  } catch {
    /* Best-effort cleanup of empty dirs */
  }
}

export function copyGeneratedDir(pkgRoot: string, srcRelative: string, distRelative: string): void {
  const src = resolve(pkgRoot, srcRelative);
  if (!existsSync(src)) {
    throw new Error(`${srcRelative}/ not found. Run prebuild first.`);
  }
  cpSync(src, resolve(pkgRoot, distRelative), { recursive: true, force: true });
}
