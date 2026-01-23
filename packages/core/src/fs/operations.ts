import { mkdir, readFile, writeFile, unlink, rename } from "node:fs/promises";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import type { AppError } from "../errors.js";
import { isNodeError, getErrorMessage } from "../errors.js";

/** Error codes specific to file I/O operations */
export type FileIOErrorCode = "NOT_FOUND" | "PERMISSION_DENIED" | "READ_ERROR" | "WRITE_ERROR";

/**
 * Error type for file I/O operations.
 *
 * Extends the AppError pattern with an additional `path` field to capture
 * the filesystem path involved in the error. This provides better context
 * for debugging and error messages.
 *
 * @example
 * ```typescript
 * const error: FileIOError = {
 *   code: "NOT_FOUND",
 *   message: "Config file not found",
 *   path: "/home/user/.config/app.json",
 * };
 * ```
 */
export interface FileIOError {
  /** File I/O error code */
  code: FileIOErrorCode;
  /** Human-readable error message */
  message: string;
  /** Filesystem path that caused the error */
  path: string;
  /** Optional additional context */
  details?: string;
}

export type ErrorFactory<E> = (code: FileIOErrorCode, message: string, details?: string) => E;

export function createMappedErrorFactory<DomainCode extends string>(
  mapping: Record<FileIOErrorCode, DomainCode>,
  errorCreator: <C extends string>(code: C, message: string, details?: string) => AppError<C>
): ErrorFactory<AppError<DomainCode>> {
  return (code, message, details) => errorCreator(mapping[code], message, details);
}

export function createFileIOError(
  code: FileIOErrorCode,
  message: string,
  path: string,
  details?: string
): FileIOError {
  return { code, message, path, details };
}

export async function safeReadFile<E>(
  path: string,
  name: string,
  errorFactory: ErrorFactory<E>
): Promise<Result<string, E>> {
  try {
    const content = await readFile(path, "utf-8");
    return ok(content);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return err(errorFactory("NOT_FOUND", `${name} not found: ${path}`));
    }
    if (isNodeError(error, "EACCES")) {
      return err(errorFactory("PERMISSION_DENIED", `Permission denied: ${path}`));
    }
    return err(errorFactory("READ_ERROR", `Failed to read ${name}`, getErrorMessage(error)));
  }
}

export interface EnsureDirectoryOptions {
  mode?: number;
}

export async function ensureDirectory<E>(
  dirPath: string,
  name: string,
  errorFactory: ErrorFactory<E>,
  options?: EnsureDirectoryOptions
): Promise<Result<void, E>> {
  try {
    await mkdir(dirPath, { recursive: true, mode: options?.mode });
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(errorFactory("PERMISSION_DENIED", `Permission denied: ${dirPath}`));
    }
    return err(
      errorFactory("WRITE_ERROR", `Failed to create ${name} directory`, getErrorMessage(error))
    );
  }
}

export interface AtomicWriteOptions {
  mode?: number;
}

export async function atomicWriteFile<E>(
  path: string,
  content: string,
  name: string,
  errorFactory: ErrorFactory<E>,
  options?: AtomicWriteOptions
): Promise<Result<void, E>> {
  const tempPath = path + "." + Date.now() + ".tmp";

  try {
    await writeFile(tempPath, content, { mode: options?.mode ?? 0o600 });
    await rename(tempPath, path);
    return ok(undefined);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {}
    if (isNodeError(error, "EACCES")) {
      return err(errorFactory("PERMISSION_DENIED", `Permission denied: ${path}`));
    }
    return err(errorFactory("WRITE_ERROR", `Failed to write ${name}`, getErrorMessage(error)));
  }
}
