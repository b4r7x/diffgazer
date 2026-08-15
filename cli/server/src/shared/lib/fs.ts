import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import type { FileHandle } from "node:fs/promises";
import * as path from "node:path";
import { getErrorMessage } from "@diffgazer/core/errors";
import { log } from "./log.js";
import { isNodeError } from "./node-error.js";

export { isNodeError } from "./node-error.js";

const DEFAULT_DIR_MODE = 0o700;
const DEFAULT_FILE_MODE = 0o600;

const isDirectoryFsyncUnsupported = (error: unknown): boolean =>
  isNodeError(error, "EINVAL") ||
  isNodeError(error, "ENOTSUP") ||
  isNodeError(error, "EOPNOTSUPP") ||
  (process.platform === "win32" && isNodeError(error, "EACCES"));

const syncDirectory = async (directoryPath: string): Promise<void> => {
  const handle = await fs.promises.open(directoryPath, "r");
  let syncError: unknown;
  let hasSyncError = false;
  try {
    await handle.sync();
  } catch (error) {
    if (!isDirectoryFsyncUnsupported(error)) {
      syncError = error;
      hasSyncError = true;
    }
  }

  let closeError: unknown;
  let hasCloseError = false;
  try {
    await handle.close();
  } catch (error) {
    closeError = error;
    hasCloseError = true;
  }

  if (hasSyncError) throw syncError;
  if (hasCloseError) throw closeError;
};

const syncDirectorySync = (directoryPath: string): void => {
  const descriptor = fs.openSync(directoryPath, "r");
  let syncError: unknown;
  let hasSyncError = false;
  try {
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (!isDirectoryFsyncUnsupported(error)) {
      syncError = error;
      hasSyncError = true;
    }
  }

  let closeError: unknown;
  let hasCloseError = false;
  try {
    fs.closeSync(descriptor);
  } catch (error) {
    closeError = error;
    hasCloseError = true;
  }

  if (hasSyncError) throw syncError;
  if (hasCloseError) throw closeError;
};

const ensureDirSync = (dirPath: string, mode: number = DEFAULT_DIR_MODE): void => {
  fs.mkdirSync(dirPath, { recursive: true, mode });
};

/**
 * Tightens one app-owned state directory whose mode is looser than `mode`.
 * `mkdir` applies its mode only at creation, so a directory made under a wider
 * umask or by an earlier build keeps that mode forever. Only the named
 * directory is touched, never its ancestors.
 */
export const restrictDirectoryMode = async (dirPath: string, mode: number): Promise<void> => {
  // Windows synthesizes POSIX mode bits, so the comparison never describes a
  // real ACL and chmod cannot express one.
  if (process.platform === "win32") return;
  const stats = await fs.promises.stat(dirPath);
  if ((stats.mode & 0o777 & ~mode) !== 0) await fs.promises.chmod(dirPath, mode);
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
  log("warn", "fs_json_parse_failed", { filePath, error: result.error });
  return null;
};

export const writeJsonFileSync = (
  filePath: string,
  data: unknown,
  mode: number = DEFAULT_FILE_MODE,
): void => {
  ensureDirSync(path.dirname(filePath), DEFAULT_DIR_MODE);

  atomicWriteFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, mode);
};

/** Creates a JSON file without replacing an existing winner. */
export const writeJsonFileSyncExclusive = (
  filePath: string,
  data: unknown,
  mode: number = DEFAULT_FILE_MODE,
): void => {
  const dir = path.dirname(filePath);
  ensureDirSync(dir, DEFAULT_DIR_MODE);

  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;
  let descriptor: number | undefined;
  let tempCreated = false;

  try {
    descriptor = fs.openSync(tempPath, "wx", mode);
    tempCreated = true;
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(tempPath, filePath);
    syncDirectorySync(dir);
    fs.unlinkSync(tempPath);
    tempCreated = false;
    syncDirectorySync(dir);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    if (tempCreated) {
      // Best-effort cleanup of the temp name owned by this operation.
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
    throw error;
  }
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

export const removeFileSyncDurable = (filePath: string): boolean => {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return false;
    throw error;
  }

  syncDirectorySync(path.dirname(filePath));
  return true;
};

export const syncParentDirectorySync = (filePath: string): void => {
  syncDirectorySync(path.dirname(filePath));
};

export async function writeJsonFile(
  filePath: string,
  data: unknown,
  mode: number = DEFAULT_FILE_MODE,
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true, mode: DEFAULT_DIR_MODE });

  await atomicWriteFile(filePath, `${JSON.stringify(data, null, 2)}\n`, mode);
}

const TEMP_SIBLING_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/;

/**
 * Drop the temp siblings an atomic write strands when the process dies between
 * its write and its rename. They can hold the full payload — including the
 * recovery journal's copy of the secrets file — and nothing else ever sweeps
 * them. The caller must hold the file's transaction lock so no live write is
 * staging under this name.
 */
export function removeOrphanTempSiblings(filePath: string): void {
  const directory = path.dirname(filePath);
  const prefix = `${path.basename(filePath)}.`;
  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    if (!TEMP_SIBLING_NAME.test(entry.slice(prefix.length))) continue;
    try {
      fs.unlinkSync(path.join(directory, entry));
    } catch {}
  }
}

function atomicWriteFileSync(filePath: string, content: string, mode: number): void {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  let descriptor: number | undefined;
  let tempCreated = false;
  try {
    descriptor = fs.openSync(tempPath, "wx", mode);
    tempCreated = true;
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(tempPath, filePath);
    syncDirectorySync(path.dirname(filePath));
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    if (tempCreated) {
      // Best-effort cleanup of the temp name owned by this operation.
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
    throw error;
  }
}

export async function atomicWriteFile(
  filePath: string,
  content: string | Uint8Array,
  mode: number = DEFAULT_FILE_MODE,
): Promise<void> {
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  let handle: FileHandle | undefined;
  let tempCreated = false;
  try {
    handle = await fs.promises.open(tempPath, "wx", mode);
    tempCreated = true;
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.promises.rename(tempPath, filePath);
    await syncDirectory(path.dirname(filePath));
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (tempCreated) {
      // Best-effort cleanup of the temp name owned by this operation.
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
    }
    throw error;
  }
}
