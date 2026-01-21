import { access, mkdir, readFile, writeFile, readdir, unlink, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { ZodSchema } from "zod";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { isNodeError, getErrorMessage } from "../errors.js";
import { isValidUuid } from "../validation.js";

export type StoreErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";

export interface StoreError {
  code: StoreErrorCode;
  message: string;
  details?: string;
}

export function createStoreError(
  code: StoreErrorCode,
  message: string,
  details?: string
): StoreError {
  return { code, message, details };
}

export interface JsonStoreConfig<T, M> {
  name: string;
  dir: () => string;
  filePath: (id: string) => string;
  schema: ZodSchema<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
}

export interface JsonStore<T, M> {
  ensureDir(): Promise<Result<void, StoreError>>;
  read(id: string): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>>;
  remove(id: string): Promise<Result<{ existed: boolean }, StoreError>>;
}

export function createJsonStore<T, M>(config: JsonStoreConfig<T, M>): JsonStore<T, M> {
  const { name, dir, filePath, schema, getMetadata, getId } = config;

  async function ensureDir(): Promise<Result<void, StoreError>> {
    const dirPath = dir();
    try {
      await mkdir(dirPath, { recursive: true });
      return ok(undefined);
    } catch (error) {
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${dirPath}`));
      }
      return err(
        createStoreError("WRITE_ERROR", `Failed to create ${name} directory`, getErrorMessage(error))
      );
    }
  }

  async function read(id: string): Promise<Result<T, StoreError>> {
    const path = filePath(id);

    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return err(createStoreError("NOT_FOUND", `${name} not found: ${id}`));
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("PARSE_ERROR", `Failed to read ${name} file`, getErrorMessage(error)));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return err(createStoreError("PARSE_ERROR", "Invalid JSON", getErrorMessage(error)));
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      return err(createStoreError("VALIDATION_ERROR", "Schema validation failed", result.error.message));
    }

    return ok(result.data);
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const ensureResult = await ensureDir();
    if (!ensureResult.ok) return ensureResult;

    const validation = schema.safeParse(item);
    if (!validation.success) {
      return err(createStoreError("VALIDATION_ERROR", `Invalid ${name}`, validation.error.message));
    }

    const id = getId(item);
    const path = filePath(id);
    const tempPath = `${path}.${Date.now()}.tmp`;

    try {
      const content = JSON.stringify(item, null, 2) + "\n";
      await writeFile(tempPath, content, { mode: 0o600 });
      await rename(tempPath, path);
    } catch (error) {
      try {
        await unlink(tempPath);
      } catch {}
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to write ${name}`, getErrorMessage(error)));
    }

    return ok(undefined);
  }

  async function list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>> {
    const dirPath = dir();
    const warnings: string[] = [];

    let files: string[];
    try {
      files = await readdir(dirPath);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok({ items: [], warnings });
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${dirPath}`));
      }
      return err(createStoreError("PARSE_ERROR", `Failed to read ${name} directory`, getErrorMessage(error)));
    }

    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const ids = jsonFiles
      .map((f) => f.replace(".json", ""))
      .filter(isValidUuid);
    const results = await Promise.all(ids.map(read));

    const items: M[] = [];
    results.forEach((result, i) => {
      if (result.ok) {
        items.push(getMetadata(result.value));
      } else {
        warnings.push(`[${name}] Failed to read ${ids[i]}: ${result.error.message}`);
      }
    });

    return ok({ items, warnings });
  }

  async function remove(id: string): Promise<Result<{ existed: boolean }, StoreError>> {
    const path = filePath(id);

    try {
      await unlink(path);
      return ok({ existed: true });
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok({ existed: false });
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to delete ${name}`, getErrorMessage(error)));
    }
  }

  return { ensureDir, read, write, list, remove };
}

export interface StorageConfig<T> {
  name: string;
  filePath: () => string;
  schema: ZodSchema<T>;
}

export interface Storage<T> {
  exists(): Promise<boolean>;
  read(): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  remove(): Promise<Result<void, StoreError>>;
}

export function createStorage<T>(config: StorageConfig<T>): Storage<T> {
  const { name, filePath, schema } = config;

  async function exists(): Promise<boolean> {
    try {
      await access(filePath());
      return true;
    } catch {
      return false;
    }
  }

  async function read(): Promise<Result<T, StoreError>> {
    const path = filePath();

    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return err(createStoreError("NOT_FOUND", `${name} not found at ${path}`));
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("PARSE_ERROR", `Failed to read ${name}`, getErrorMessage(error)));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return err(createStoreError("PARSE_ERROR", `${name} contains invalid JSON`, getErrorMessage(error)));
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      return err(createStoreError("VALIDATION_ERROR", `${name} failed validation`, result.error.message));
    }

    return ok(result.data);
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const validation = schema.safeParse(item);
    if (!validation.success) {
      return err(createStoreError("VALIDATION_ERROR", `Invalid ${name}`, validation.error.message));
    }

    const path = filePath();
    const dir = dirname(path);

    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied creating directory: ${dir}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to create ${name} directory`, getErrorMessage(error)));
    }

    try {
      const content = JSON.stringify(item, null, 2) + "\n";
      await writeFile(path, content, { mode: 0o600 });
    } catch (error) {
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to write ${name}`, getErrorMessage(error)));
    }

    return ok(undefined);
  }

  async function remove(): Promise<Result<void, StoreError>> {
    const path = filePath();

    try {
      await unlink(path);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok(undefined);
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to delete ${name}`, getErrorMessage(error)));
    }

    return ok(undefined);
  }

  return { exists, read, write, remove };
}

export function filterByProjectAndSort<T extends { projectPath: string }>(
  items: T[],
  projectPath: string | undefined,
  dateField: keyof T
): T[] {
  let filtered = items;
  if (projectPath) {
    filtered = items.filter((item) => item.projectPath === projectPath);
  }
  return filtered.sort(
    (a, b) => new Date(b[dateField] as string).getTime() - new Date(a[dateField] as string).getTime()
  );
}
