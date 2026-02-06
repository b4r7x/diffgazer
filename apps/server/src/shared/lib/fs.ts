import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_DIR_MODE = 0o700;
const DEFAULT_FILE_MODE = 0o600;

const ensureDirSync = (dirPath: string, mode: number = DEFAULT_DIR_MODE): void => {
  fs.mkdirSync(dirPath, { recursive: true, mode });
};

export const readJsonFileSync = <T>(filePath: string): T | null => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    }
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
    if (error instanceof Error && "code" in error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    }
    throw error;
  }
};

export async function atomicWriteFile(
  filePath: string,
  content: string,
  mode: number = DEFAULT_FILE_MODE
): Promise<void> {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, content, { mode });
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    try { await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
}
