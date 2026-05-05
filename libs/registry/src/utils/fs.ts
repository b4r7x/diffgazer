import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";

export function relativePath(base: string, filePath: string): string {
  return filePath.startsWith(`${base}/`) ? filePath.slice(base.length + 1) : filePath;
}

export function ensureExists(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`${label} not found at "${path}"`);
  }
}

export function resetDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
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
