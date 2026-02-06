import { mkdir, readFile, writeFile, readdir, unlink, rename, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import type { ZodType } from "zod";
import { type Result, ok, err, type AppError, createError, getErrorMessage, safeParseJson } from "@stargazer/core";

const isNodeError = (error: unknown, code: string): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
import { isValidUuid, parseAndValidate, validateSchema } from "../validation.js";

export type StoreErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";

export type StoreError = AppError<StoreErrorCode>;

const createStoreError = createError<StoreErrorCode>;

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

async function atomicWriteFile(
  path: string,
  content: string,
  name: string
): Promise<Result<void, StoreError>> {
  const tempPath = path + "." + Date.now() + ".tmp";

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

const CHUNK_SIZE = 4096;
const MAX_METADATA_SIZE = 8192;

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

function parseMetadataJson<M>(
  buffer: string,
  schema: ZodType<M>,
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

  const parseResult = safeParseJson(metadataJson, (message) =>
    createStoreError("PARSE_ERROR", `${name} metadata: ${message}`)
  );
  if (!parseResult.ok) {
    return parseResult;
  }

  return validateSchema(
    parseResult.value,
    schema,
    (message) => createStoreError("VALIDATION_ERROR", `${name} metadata validation failed`, message)
  );
}

async function extractMetadataFromFile<M>(
  path: string,
  schema: ZodType<M>,
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

interface CollectionConfig<T, M> {
  name: string;
  dir: string;
  filePath: (id: string) => string;
  schema: ZodType<T>;
  getMetadata: (item: T) => M;
  getId: (item: T) => string;
  metadataSchema?: ZodType<M>;
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
    if (!readResult.ok) return readResult;
    return parseAndValidate(
      readResult.value,
      schema,
      (message) => createStoreError("PARSE_ERROR", `${name}: ${message}`),
      (message) => createStoreError("VALIDATION_ERROR", `${name} failed validation`, message)
    );
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const ensureResult = await ensureDir();
    if (!ensureResult.ok) return ensureResult;

    const id = getId(item);
    const path = filePath(id);
    const content = JSON.stringify(item, null, 2) + "\n";

    return atomicWriteFile(path, content, name);
  }

  async function list(): Promise<Result<{ items: M[]; warnings: string[] }, StoreError>> {
    const warnings: string[] = [];

    let files: string[];
    try {
      files = await readdir(dir);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return ok({ items: [], warnings });
      }
      if (isNodeError(error, "EACCES")) {
        return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${dir}`));
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

