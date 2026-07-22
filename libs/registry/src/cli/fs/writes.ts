import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function atomicWriteFile(
  targetPath: string,
  content: string,
  opts?: { ensureDir?: boolean },
): void {
  if (opts?.ensureDir !== false) {
    mkdirSync(dirname(targetPath), { recursive: true });
  }
  const tmpPath = join(dirname(targetPath), `.tmp-${randomBytes(6).toString("hex")}`);
  try {
    writeFileSync(tmpPath, content);
    renameSync(tmpPath, targetPath);
  } catch (e) {
    try {
      rmSync(tmpPath);
    } catch {
      /* Best-effort temp file cleanup; original error is re-thrown */
    }
    throw e;
  }
}

export type WriteResult = "written" | "skipped" | "overwritten";

export function writeFileSafe(
  filePath: string,
  content: string,
  overwrite: boolean = false,
): WriteResult {
  const exists = existsSync(filePath);

  if (exists && !overwrite) {
    return "skipped";
  }

  atomicWriteFile(filePath, content);

  return exists ? "overwritten" : "written";
}
