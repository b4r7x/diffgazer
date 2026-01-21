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

async function safeReadFile(path: string, name: string): Promise<Result<string, StoreError>> {
  try {
    const content = await readFile(path, "utf-8");
    return ok(content);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return err(createStoreError("NOT_FOUND", `${name} not found: ${path}`));
    }
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
    }
    return err(createStoreError("PARSE_ERROR", `Failed to read ${name}`, getErrorMessage(error)));
  }
}

function parseAndValidate<T>(
  content: string,
  schema: ZodSchema<T>,
  name: string
): Result<T, StoreError> {
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

async function atomicWriteFile(
  path: string,
  content: string,
  name: string
): Promise<Result<void, StoreError>> {
  const tempPath = `${path}.${Date.now()}.tmp`;

  try {
    await writeFile(tempPath, content, { mode: 0o600 });
    await rename(tempPath, path);
    return ok(undefined);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {}
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
    }
    return err(createStoreError("WRITE_ERROR", `Failed to write ${name}`, getErrorMessage(error)));
  }
}

async function ensureDirectory(dirPath: string, name: string): Promise<Result<void, StoreError>> {
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

export interface CollectionConfig<T, M> {
  name: string;
  dir: () => string;
  filePath: (id: string) => string;
  schema: ZodSchema<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
}

export interface Collection<T, M> {
  ensureDir(): Promise<Result<void, StoreError>>;
  read(id: string): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>>;
  remove(id: string): Promise<Result<{ existed: boolean }, StoreError>>;
}

export function createCollection<T, M>(config: CollectionConfig<T, M>): Collection<T, M> {
  const { name, dir, filePath, schema, getMetadata, getId } = config;

  async function ensureDir(): Promise<Result<void, StoreError>> {
    return ensureDirectory(dir(), name);
  }

  async function read(id: string): Promise<Result<T, StoreError>> {
    const path = filePath(id);
    const readResult = await safeReadFile(path, name);
    if (!readResult.ok) {
      if (readResult.error.code === "NOT_FOUND") {
        return err(createStoreError("NOT_FOUND", `${name} not found: ${id}`));
      }
      return readResult;
    }

    const parseResult = parseAndValidate(readResult.value, schema, name);
    if (!parseResult.ok) {
      if (parseResult.error.code === "PARSE_ERROR") {
        return err(createStoreError("PARSE_ERROR", "Invalid JSON", parseResult.error.details));
      }
      if (parseResult.error.code === "VALIDATION_ERROR") {
        return err(createStoreError("VALIDATION_ERROR", "Schema validation failed", parseResult.error.details));
      }
      return parseResult;
    }

    return parseResult;
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
    const content = JSON.stringify(item, null, 2) + "\n";

    return atomicWriteFile(path, content, name);
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

export interface DocumentConfig<T> {
  name: string;
  filePath: () => string;
  schema: ZodSchema<T>;
}

export interface Document<T> {
  exists(): Promise<boolean>;
  read(): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  remove(): Promise<Result<void, StoreError>>;
}

export function createDocument<T>(config: DocumentConfig<T>): Document<T> {
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
    const readResult = await safeReadFile(path, name);
    if (!readResult.ok) {
      if (readResult.error.code === "NOT_FOUND") {
        return err(createStoreError("NOT_FOUND", `${name} not found at ${path}`));
      }
      return readResult;
    }

    return parseAndValidate(readResult.value, schema, name);
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const validation = schema.safeParse(item);
    if (!validation.success) {
      return err(createStoreError("VALIDATION_ERROR", `Invalid ${name}`, validation.error.message));
    }

    const path = filePath();
    const dir = dirname(path);

    const dirResult = await ensureDirectory(dir, name);
    if (!dirResult.ok) {
      if (dirResult.error.code === "PERMISSION_ERROR") {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied creating directory: ${dir}`));
      }
      return dirResult;
    }

    const content = JSON.stringify(item, null, 2) + "\n";
    return atomicWriteFile(path, content, name);
  }

  async function remove(): Promise<Result<void, StoreError>> {
    const path = filePath();

    try {
      await unlink(path);
      return ok(undefined);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok(undefined);
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
      }
      return err(createStoreError("WRITE_ERROR", `Failed to delete ${name}`, getErrorMessage(error)));
    }
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
