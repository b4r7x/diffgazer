import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getErrorMessage } from "@diffgazer/core/errors";

const DEFAULT_DIR_MODE = 0o700;
const DEFAULT_FILE_MODE = 0o600;

export const isNodeError = (error: unknown, code?: string): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && (code === undefined || (error as NodeJS.ErrnoException).code === code);

const ensureDirSync = (dirPath: string, mode: number = DEFAULT_DIR_MODE): void => {
  fs.mkdirSync(dirPath, { recursive: true, mode });
};

export type JsonReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "missing" }
  | { status: "corrupt"; error: string };

export const readJsonFileSyncSafe = <T>(filePath: string): JsonReadResult<T> => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { status: "ok", data: JSON.parse(content) as T };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return { status: "missing" };
    return { status: "corrupt", error: getErrorMessage(error) };
  }
};

export const quarantineCorruptFile = (filePath: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.${timestamp}.backup`;
  fs.renameSync(filePath, backupPath);
  return backupPath;
};

export const getFileMtimeMs = (filePath: string): number | null => {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
};

export const readJsonFileSync = <T>(filePath: string): T | null => {
  const result = readJsonFileSyncSafe<T>(filePath);
  if (result.status === "ok") return result.data;
  if (result.status === "missing") return null;
  console.warn(`[fs] Failed to parse JSON from ${filePath}:`, result.error);
  return null;
};

export const writeJsonFileSync = (
  filePath: string,
  data: unknown,
  mode: number = DEFAULT_FILE_MODE
): void => {
  const dir = path.dirname(filePath);
  ensureDirSync(dir, DEFAULT_DIR_MODE);

  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;

  fs.writeFileSync(tempPath, content, { mode });
  fs.renameSync(tempPath, filePath);
};

export const removeFileSync = (filePath: string): boolean => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return false;
    throw error;
  }
};

export const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return null;
    return null;
  }
};

export async function writeJsonFile(
  filePath: string,
  data: unknown,
  mode: number = DEFAULT_FILE_MODE
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true, mode: DEFAULT_DIR_MODE });

  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;

  try {
    await fs.promises.writeFile(tempPath, content, { mode });
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    // Best-effort temp-file cleanup; the original error is what callers need, and
    // a leftover .tmp on an unlink failure is harmless (it is uniquely named).
    try { await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
}

export async function atomicWriteFile(
  filePath: string,
  content: string,
  mode: number = DEFAULT_FILE_MODE
): Promise<void> {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, content, { mode });
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    // Best-effort temp-file cleanup; the original error is what callers need, and
    // a leftover .tmp on an unlink failure is harmless (it is uniquely named).
    try { await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
}
