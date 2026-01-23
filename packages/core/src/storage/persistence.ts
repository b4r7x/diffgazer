import { access, mkdir, readFile, writeFile, readdir, unlink, rename, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import type { ZodSchema } from "zod";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import type { AppError } from "../errors.js";
import { isNodeError, getErrorMessage, createError } from "../errors.js";
import { isValidUuid } from "../validation.js";

export type StoreErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";

export type StoreError = AppError<StoreErrorCode>;

export const createStoreError = createError<StoreErrorCode>;

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
    } catch (cleanupError) {
      // Log but don't fail - cleanup is best-effort
      console.warn(`Failed to cleanup temp file ${tempPath}:`, cleanupError);
    }
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

const CHUNK_SIZE = 4096;
const MAX_METADATA_SIZE = 8192;

/**
 * Reads file in chunks using async iteration.
 * Yields buffers until maxBytes is read or file ends.
 */
async function* readFileChunks(
  handle: FileHandle,
  chunkSize: number,
  maxBytes: number
): AsyncGenerator<Buffer, void, unknown> {
  let totalRead = 0;
  const buffer = Buffer.alloc(chunkSize);

  while (totalRead < maxBytes) {
    const { bytesRead } = await handle.read(buffer, 0, chunkSize, totalRead);
    if (bytesRead === 0) break;
    totalRead += bytesRead;
    yield buffer.subarray(0, bytesRead);
  }
}

/** Finds the closing brace index using brace counting, handling strings. */
function findClosingBrace(buffer: string, startIndex: number): number {
  let depth = 1;
  let inString = false;
  let escaped = false;

  for (let i = startIndex + 1; i < buffer.length; i++) {
    const char = buffer[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return i + 1;
  }
  return -1;
}

/** Finds the metadata object boundary in a JSON buffer. Returns -1 if not found. */
function findMetadataBoundary(buffer: string): number {
  const metadataKey = '"metadata"';
  const keyIndex = buffer.indexOf(metadataKey);
  if (keyIndex === -1) return -1;

  const colonIndex = buffer.indexOf(":", keyIndex + metadataKey.length);
  if (colonIndex === -1) return -1;

  const openBrace = buffer.indexOf("{", colonIndex);
  if (openBrace === -1) return -1;

  return findClosingBrace(buffer, openBrace);
}

/**
 * Parses and validates metadata JSON string against a schema.
 * Constructs a minimal JSON object wrapping the metadata.
 */
function parseMetadataJson<M>(
  buffer: string,
  schema: ZodSchema<M>,
  name: string
): Result<M, StoreError> {
  const metadataKey = '"metadata"';
  const keyIndex = buffer.indexOf(metadataKey);
  if (keyIndex === -1) {
    return err(createStoreError("PARSE_ERROR", `${name} missing metadata key`));
  }

  const endIndex = findMetadataBoundary(buffer);
  if (endIndex === -1) {
    return err(createStoreError("PARSE_ERROR", `${name} has incomplete metadata`));
  }

  const colonIndex = buffer.indexOf(":", keyIndex + metadataKey.length);
  const metadataJson = buffer.slice(colonIndex + 1, endIndex).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(metadataJson);
  } catch (error) {
    return err(createStoreError("PARSE_ERROR", `${name} invalid metadata JSON`, getErrorMessage(error)));
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return err(createStoreError("VALIDATION_ERROR", `${name} metadata validation failed`, result.error.message));
  }
  return ok(result.data);
}

/**
 * Extracts metadata from a file by streaming only the beginning portion.
 * Reads chunks until metadata is found and validated, avoiding full file load.
 */
async function extractMetadataFromFile<M>(
  path: string,
  schema: ZodSchema<M>,
  name: string
): Promise<Result<M, StoreError>> {
  let handle: FileHandle | null = null;

  try {
    handle = await open(path, "r");
    let buffer = "";

    for await (const chunk of readFileChunks(handle, CHUNK_SIZE, MAX_METADATA_SIZE)) {
      buffer += chunk.toString("utf-8");
      const boundaryIndex = findMetadataBoundary(buffer);
      if (boundaryIndex !== -1) {
        return parseMetadataJson(buffer, schema, name);
      }
    }

    return parseMetadataJson(buffer, schema, name);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return err(createStoreError("NOT_FOUND", `${name} not found: ${path}`));
    }
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
    }
    return err(createStoreError("PARSE_ERROR", `Failed to read ${name}`, getErrorMessage(error)));
  } finally {
    await handle?.close();
  }
}

export interface CollectionConfig<T, M> {
  name: string;
  dir: string;
  filePath: (id: string) => string;
  schema: ZodSchema<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
  metadataSchema?: ZodSchema<M>;
}

export interface Collection<T, M> {
  ensureDir(): Promise<Result<void, StoreError>>;
  read(id: string): Promise<Result<T, StoreError>>;
  write(item: T): Promise<Result<void, StoreError>>;
  list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>>;
  remove(id: string): Promise<Result<{ existed: boolean }, StoreError>>;
}

export function createCollection<T, M>(config: CollectionConfig<T, M>): Collection<T, M> {
  const { name, dir, filePath, schema, getMetadata, getId, metadataSchema } = config;

  async function ensureDir(): Promise<Result<void, StoreError>> {
    return ensureDirectory(dir, name);
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

    // Note: Write-time schema validation removed as redundant.
    // Data is constructed programmatically by domain functions (createSession, addMessage, etc.)
    // from already-validated route inputs + generated fields. TypeScript enforces structure.
    // Read-time validation remains to protect against corrupted/manually-edited files.

    const id = getId(item);
    const path = filePath(id);
    const content = JSON.stringify(item, null, 2) + "\n";

    return atomicWriteFile(path, content, name);
  }

  async function list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>> {
    const dirPath = dir;
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

    const items: M[] = [];

    if (metadataSchema) {
      const results = await Promise.all(
        ids.map((id) => extractMetadataFromFile(filePath(id), metadataSchema, name))
      );
      results.forEach((result, i) => {
        if (result.ok) {
          items.push(result.value);
        } else {
          warnings.push(`[${name}] Failed to read ${ids[i]}: ${result.error.message}`);
        }
      });
    } else {
      const results = await Promise.all(ids.map(read));
      results.forEach((result, i) => {
        if (result.ok) {
          items.push(getMetadata(result.value));
        } else {
          warnings.push(`[${name}] Failed to read ${ids[i]}: ${result.error.message}`);
        }
      });
    }

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
  filePath: string;
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
      await access(filePath);
      return true;
    } catch (error) {
      // Only return false for "file not found"
      // Permission errors etc. should propagate
      if (isNodeError(error, "ENOENT")) {
        return false;
      }
      throw error;
    }
  }

  async function read(): Promise<Result<T, StoreError>> {
    const readResult = await safeReadFile(filePath, name);
    if (!readResult.ok) {
      if (readResult.error.code === "NOT_FOUND") {
        return err(createStoreError("NOT_FOUND", `${name} not found at ${filePath}`));
      }
      return readResult;
    }

    return parseAndValidate(readResult.value, schema, name);
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    // Note: Write-time schema validation removed as redundant.
    // Data is constructed programmatically by domain functions from validated inputs.
    // TypeScript enforces structure. Read-time validation remains for disk integrity.

    const dir = dirname(filePath);

    const dirResult = await ensureDirectory(dir, name);
    if (!dirResult.ok) {
      if (dirResult.error.code === "PERMISSION_ERROR") {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied creating directory: ${dir}`));
      }
      return dirResult;
    }

    const content = JSON.stringify(item, null, 2) + "\n";
    return atomicWriteFile(filePath, content, name);
  }

  async function remove(): Promise<Result<void, StoreError>> {
    try {
      await unlink(filePath);
      return ok(undefined);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok(undefined);
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${filePath}`));
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
