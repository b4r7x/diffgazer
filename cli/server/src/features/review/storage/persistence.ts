import { mkdir, readdir, readFile, unlink } from "node:fs/promises";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { safeParseJson } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
import type { ZodType } from "zod";
import { atomicWriteFile as atomicWrite, isNodeError } from "../../../shared/lib/fs.js";
import type { Collection, CollectionConfig, StoreError, StoreErrorCode } from "./types.js";

interface ExtendedCollectionConfig<T, M> extends CollectionConfig<T, M> {
  coerceMetadata?: (metadata: unknown) => unknown;
  transformRead?: (item: T) => T;
}

type ExtendedCollection<T, M> = Collection<T, M> & {
  readDetailed(id: string): Promise<Result<{ item: T; salvaged: boolean }, StoreError>>;
  readMetadata(id: string): Promise<Result<M, StoreError>>;
};

const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;

const validateSchema = <T, E>(
  value: unknown,
  schema: ZodType<T>,
  errorFactory: (message: string) => E,
): Result<T, E> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return err(errorFactory(result.error.message));
  }
  return ok(result.data);
};

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
    await mkdir(dirPath, { recursive: true, mode: 0o700 });
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${dirPath}`));
    }
    return err(
      createStoreError("WRITE_ERROR", `Failed to create ${name} directory`, getErrorMessage(error)),
    );
  }
}

async function safeAtomicWrite(
  path: string,
  content: string,
  name: string,
): Promise<Result<void, StoreError>> {
  try {
    await atomicWrite(path, content);
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(createStoreError("PERMISSION_ERROR", `Permission denied: ${path}`));
    }
    return err(createStoreError("WRITE_ERROR", `Failed to write ${name}`, getErrorMessage(error)));
  }
}

async function extractMetadataFromFile<M>(
  path: string,
  schema: ZodType<M>,
  name: string,
  coerceMetadata?: (metadata: unknown) => unknown,
): Promise<Result<M, StoreError>> {
  const readResult = await safeReadFile(path, name);
  if (!readResult.ok) return readResult;

  const parseResult = safeParseJson(readResult.value, (message) =>
    createStoreError("PARSE_ERROR", `${name}: ${message}`),
  );
  if (!parseResult.ok) return parseResult;

  const metadata = (parseResult.value as Record<string, unknown>).metadata;
  if (metadata === undefined) {
    return err(createStoreError("PARSE_ERROR", `${name} missing metadata key`));
  }

  return validateSchema(coerceMetadata ? coerceMetadata(metadata) : metadata, schema, (message) =>
    createStoreError("VALIDATION_ERROR", `${name} metadata validation failed`, message),
  );
}

export type { Collection, StoreError, StoreErrorCode } from "./types.js";

export function createCollection<T, M>(
  config: ExtendedCollectionConfig<T, M>,
): ExtendedCollection<T, M> {
  const {
    name,
    dir,
    filePath,
    schema,
    getMetadata,
    getId,
    metadataSchema,
    lenientRead,
    coerceMetadata,
    transformRead,
  } = config;

  async function ensureDir(): Promise<Result<void, StoreError>> {
    return ensureDirectory(dir, name);
  }

  function transform(item: T): T {
    return transformRead ? transformRead(item) : item;
  }

  async function readDetailed(
    id: string,
  ): Promise<Result<{ item: T; salvaged: boolean }, StoreError>> {
    const path = filePath(id);
    const readResult = await safeReadFile(path, name);
    if (!readResult.ok) return readResult;

    // JSON corruption is unrecoverable and still surfaces as a PARSE_ERROR (and a
    // listing warning); only a schema-validation failure on otherwise-valid JSON
    // is salvaged through the lenient read so immutable old records open and delete.
    const parseResult = safeParseJson(readResult.value, (message) =>
      createStoreError("PARSE_ERROR", `${name}: ${message}`),
    );
    if (!parseResult.ok) return parseResult;

    const validation = schema.safeParse(parseResult.value);
    if (validation.success) return ok({ item: transform(validation.data), salvaged: false });

    if (lenientRead) {
      const salvaged = lenientRead(parseResult.value);
      if (salvaged !== null) return ok({ item: transform(salvaged), salvaged: true });
    }

    return err(
      createStoreError("VALIDATION_ERROR", `${name} failed validation`, validation.error.message),
    );
  }

  async function read(id: string): Promise<Result<T, StoreError>> {
    const result = await readDetailed(id);
    if (!result.ok) return result;
    return ok(result.value.item);
  }

  async function readMetadata(id: string): Promise<Result<M, StoreError>> {
    if (metadataSchema) {
      return extractMetadataFromFile(filePath(id), metadataSchema, name, coerceMetadata);
    }

    const result = await read(id);
    if (!result.ok) return result;
    return ok(getMetadata(result.value));
  }

  async function write(item: T): Promise<Result<void, StoreError>> {
    const ensureResult = await ensureDir();
    if (!ensureResult.ok) return ensureResult;

    const id = getId(item);
    const path = filePath(id);
    const content = `${JSON.stringify(item, null, 2)}\n`;

    return safeAtomicWrite(path, content, name);
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
      return err(
        createStoreError("PARSE_ERROR", `Failed to read ${name} directory`, getErrorMessage(error)),
      );
    }

    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const ids = jsonFiles.map((f) => f.replace(".json", "")).filter(isValidUuid);

    const items: M[] = [];

    const results = await Promise.all(ids.map(readMetadata));
    results.forEach((result, i) => {
      if (result.ok) {
        items.push(result.value);
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
      return err(
        createStoreError("WRITE_ERROR", `Failed to delete ${name}`, getErrorMessage(error)),
      );
    }
  }

  return { ensureDir, read, readDetailed, readMetadata, write, list, remove };
}
