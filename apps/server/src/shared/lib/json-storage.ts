import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

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
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
    }

    console.warn(`[stargazer] Failed to read JSON file: ${filePath}`);
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

export const listJsonFilesSync = (dirPath: string): string[] => {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(dirPath, name));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
    }

    throw error;
  }
};

export const removeFileSync = (filePath: string): boolean => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return false;
    }

    throw error;
  }
};
