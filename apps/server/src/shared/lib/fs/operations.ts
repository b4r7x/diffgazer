import { mkdir, readFile, writeFile, unlink, rename } from "node:fs/promises";
import { type Result, ok, err } from "@stargazer/core";
import type { AppError } from "../errors.js";
import { isNodeError, getErrorMessage } from "../errors.js";

type FileIOErrorCode = "NOT_FOUND" | "PERMISSION_DENIED" | "READ_ERROR" | "WRITE_ERROR";

export type ErrorFactory<E> = (code: FileIOErrorCode, message: string, details?: string) => E;

export function createMappedErrorFactory<DomainCode extends string>(
  mapping: Record<FileIOErrorCode, DomainCode>,
  errorCreator: <C extends string>(code: C, message: string, details?: string) => AppError<C>
): ErrorFactory<AppError<DomainCode>> {
  return (code, message, details) => errorCreator(mapping[code], message, details);
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

interface EnsureDirectoryOptions {
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

interface AtomicWriteOptions {
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
