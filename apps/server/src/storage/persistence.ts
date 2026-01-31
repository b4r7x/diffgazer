import { access, readdir, unlink, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import type { ZodSchema } from "zod";
import type { Result } from "@repo/core";
import { ok, err } from "@repo/core";
import type { AppError } from "@repo/core";
import { createError, getErrorMessage, safeParseJson } from "@repo/core";
import { isValidUuid, parseAndValidate, validateSchema } from "../lib/validation.js";
import {
  safeReadFile as genericSafeReadFile,
  atomicWriteFile as genericAtomicWriteFile,
  ensureDirectory as genericEnsureDirectory,
  createMappedErrorFactory,
} from "../fs/operations.js";

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

export type StoreErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";

export type StoreError = AppError<StoreErrorCode>;

export const createStoreError = createError<StoreErrorCode>;

const storeErrorFactory = createMappedErrorFactory<StoreErrorCode>(
  {
    NOT_FOUND: "NOT_FOUND",
    PERMISSION_DENIED: "PERMISSION_ERROR",
    READ_ERROR: "PARSE_ERROR",
    WRITE_ERROR: "WRITE_ERROR",
  },
  createError
);

async function safeReadFile(path: string, name: string): Promise<Result<string, StoreError>> {
  return genericSafeReadFile(path, name, storeErrorFactory);
}

async function atomicWriteFile(
  path: string,
  content: string,
  name: string
): Promise<Result<void, StoreError>> {
  return genericAtomicWriteFile(path, content, name, storeErrorFactory);
}

async function ensureDirectory(dirPath: string, name: string): Promise<Result<void, StoreError>> {
  return genericEnsureDirectory(dirPath, name, storeErrorFactory);
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
      if (isNodeError(error, "ENOENT")) return false;
      throw error;
    }
  }

  async function read(): Promise<Result<T, StoreError>> {
    const readResult = await safeReadFile(filePath, name);
    if (!readResult.ok) return readResult;
    return parseAndValidate(
      readResult.value,
      schema,
      (message) => createStoreError("PARSE_ERROR", `${name}: ${message}`),
      (message) => createStoreError("VALIDATION_ERROR", `${name} failed validation`, message)
    );
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const dir = dirname(filePath);
    const dirResult = await ensureDirectory(dir, name);
    if (!dirResult.ok) return dirResult;

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
  const filtered = projectPath ? items.filter((item) => item.projectPath === projectPath) : items;
  return filtered.sort(
    (a, b) => new Date(b[dateField] as string).getTime() - new Date(a[dateField] as string).getTime()
  );
}
