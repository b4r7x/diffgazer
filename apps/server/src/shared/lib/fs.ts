import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_DIR_MODE = 0o700;
const DEFAULT_FILE_MODE = 0o600;

export const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;

const ensureDirSync = (dirPath: string, mode: number = DEFAULT_DIR_MODE): void => {
  fs.mkdirSync(dirPath, { recursive: true, mode });
};

export const readJsonFileSync = <T>(filePath: string): T | null => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
    console.warn(`[fs] Failed to parse JSON from ${filePath}:`, error instanceof Error ? error.message : error);
    return null;
  }
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
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
};

export const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return null;
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
    try { await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
}
