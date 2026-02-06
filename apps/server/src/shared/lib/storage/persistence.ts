import { mkdir, readFile, readdir, unlink } from "node:fs/promises";
import type { ZodType } from "zod";
import { type Result, ok, err, createError, getErrorMessage, safeParseJson } from "@stargazer/core";
import { UuidSchema } from "@stargazer/schemas/errors";
import { atomicWriteFile as atomicWrite } from "../fs.js";
import type { StoreErrorCode, StoreError, CollectionConfig, Collection } from "./types.js";

const isNodeError = (error: unknown, code: string): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;

const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;

const validateSchema = <T, E>(
  value: unknown,
  schema: ZodType<T>,
  errorFactory: (message: string) => E
): Result<T, E> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return err(errorFactory(result.error.message));
  }
  return ok(result.data);
};

const parseAndValidate = <T, E>(
  content: string,
  schema: ZodType<T>,
  parseErrorFactory: (message: string) => E,
  validationErrorFactory: (message: string) => E
): Result<T, E> => {
  const parseResult = safeParseJson(content, parseErrorFactory);
  if (!parseResult.ok) {
    return err(parseResult.error);
  }
  return validateSchema(parseResult.value, schema, validationErrorFactory);
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

async function safeAtomicWrite(
  path: string,
  content: string,
  name: string
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
  name: string
): Promise<Result<M, StoreError>> {
  const readResult = await safeReadFile(path, name);
  if (!readResult.ok) return readResult;

  const parseResult = safeParseJson(readResult.value, (message) =>
    createStoreError("PARSE_ERROR", `${name}: ${message}`)
  );
  if (!parseResult.ok) return parseResult;

  const metadata = (parseResult.value as Record<string, unknown>).metadata;
  if (metadata === undefined) {
    return err(createStoreError("PARSE_ERROR", `${name} missing metadata key`));
  }

  return validateSchema(metadata, schema, (message) =>
    createStoreError("VALIDATION_ERROR", `${name} metadata validation failed`, message)
  );
}

export type { StoreErrorCode, StoreError, Collection } from "./types.js";

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

