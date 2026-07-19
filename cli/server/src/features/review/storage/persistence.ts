import { mkdir, readdir, readFile } from "node:fs/promises";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { safeParseJson } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
import type { ZodType } from "zod";
import { atomicWriteFile as atomicWrite, isNodeError } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import type {
  Collection,
  CollectionConfig,
  LenientReadResult,
  StoreError,
  StoreErrorCode,
} from "./types.js";

interface ExtendedCollectionConfig<T, M, D> extends CollectionConfig<T, M, D> {
  coerceMetadata?: (metadata: unknown) => unknown;
  transformRead?: (item: T) => T;
}

type DetailedRead<T, D> =
  | { item: T; salvaged: false; diagnostics: null }
  | { item: T; salvaged: true; diagnostics: D };

type ExtendedCollection<T, M, D> = Collection<T, M> & {
  readDetailed(id: string): Promise<Result<DetailedRead<T, D>, StoreError>>;
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

// Return a path-free client message; log the raw cause (which carries the absolute
// daemon path) server-side so clients never see host filesystem internals.
function storeIoError(
  code: StoreErrorCode,
  message: string,
  path: string,
  cause: unknown,
): StoreError {
  log("warn", "review_store_io_error", { code, path, cause: getErrorMessage(cause) });
  return createStoreError(code, message);
}

async function safeReadFile(path: string, name: string): Promise<Result<string, StoreError>> {
  try {
    const content = await readFile(path, "utf-8");
    return ok(content);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return err(createStoreError("NOT_FOUND", `${name} not found`));
    }
    if (isNodeError(error, "EACCES")) {
      return err(
        storeIoError("PERMISSION_ERROR", `Permission denied reading ${name}`, path, error),
      );
    }
    return err(storeIoError("PARSE_ERROR", `Failed to read ${name}`, path, error));
  }
}

async function ensureDirectory(dirPath: string, name: string): Promise<Result<void, StoreError>> {
  try {
    await mkdir(dirPath, { recursive: true, mode: 0o700 });
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(
        storeIoError(
          "PERMISSION_ERROR",
          `Permission denied creating ${name} directory`,
          dirPath,
          error,
        ),
      );
    }
    return err(storeIoError("WRITE_ERROR", `Failed to create ${name} directory`, dirPath, error));
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
      return err(
        storeIoError("PERMISSION_ERROR", `Permission denied writing ${name}`, path, error),
      );
    }
    return err(storeIoError("WRITE_ERROR", `Failed to write ${name}`, path, error));
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

  const parsed = parseResult.value;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return err(createStoreError("PARSE_ERROR", `${name} must be a JSON object`));
  }

  const metadata = "metadata" in parsed ? parsed.metadata : undefined;
  if (metadata === undefined) {
    return err(createStoreError("PARSE_ERROR", `${name} missing metadata key`));
  }

  return validateSchema(coerceMetadata ? coerceMetadata(metadata) : metadata, schema, (message) =>
    createStoreError("VALIDATION_ERROR", `${name} metadata validation failed`, message),
  );
}

export type { Collection, StoreError, StoreErrorCode } from "./types.js";

export function createCollection<T, M, D = never>(
  config: ExtendedCollectionConfig<T, M, D>,
): ExtendedCollection<T, M, D> {
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

  async function readDetailed(id: string): Promise<Result<DetailedRead<T, D>, StoreError>> {
    const path = filePath(id);
    const readResult = await safeReadFile(path, name);
    if (!readResult.ok) return readResult;

    // Only a schema-validation failure on valid JSON is salvaged; JSON corruption
    // stays a PARSE_ERROR.
    const parseResult = safeParseJson(readResult.value, (message) =>
      createStoreError("PARSE_ERROR", `${name}: ${message}`),
    );
    if (!parseResult.ok) return parseResult;

    const validation = schema.safeParse(parseResult.value);
    if (validation.success) {
      return ok({ item: transform(validation.data), salvaged: false, diagnostics: null });
    }

    if (lenientRead) {
      const salvaged: LenientReadResult<T, D> | null = lenientRead(parseResult.value);
      if (salvaged !== null) {
        return ok({
          item: transform(salvaged.item),
          salvaged: true,
          diagnostics: salvaged.diagnostics,
        });
      }
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
        return err(
          storeIoError(
            "PERMISSION_ERROR",
            `Permission denied reading ${name} directory`,
            dir,
            error,
          ),
        );
      }
      return err(storeIoError("PARSE_ERROR", `Failed to read ${name} directory`, dir, error));
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

  return { ensureDir, read, readDetailed, readMetadata, write, list };
}
