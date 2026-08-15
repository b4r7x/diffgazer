import { z } from "zod";
import { sourceFileSchema, sourceFileWithPathSchema } from "@/lib/doc-data-schemas";
import type { HookPageData, HookSourceData } from "@/lib/generated-doc-data";
import { isDocsLibraryId } from "@/lib/library";
import type { ComponentPageData, ComponentSourceData } from "@/types/data";

const SAFE_PATH_SEGMENT = /^[a-z0-9-]+$/;

type DocPageDataByType = {
  components: ComponentPageData;
  hooks: HookPageData;
};

type DocSourceDataByType = {
  components: ComponentSourceData;
  hooks: HookSourceData;
};

type DocSourceType = keyof DocSourceDataByType;

interface LoadDocDataOptions {
  throwIfMissing?: boolean;
}

function hasSafeDocPath(library: string, name: string | undefined): name is string {
  return name !== undefined && SAFE_PATH_SEGMENT.test(library) && SAFE_PATH_SEGMENT.test(name);
}

function isDocSourceType(value: string): value is DocSourceType {
  return value === "components" || value === "hooks";
}

const componentSourceDataSchema = z.looseObject({
  source: z.record(z.string(), sourceFileSchema).refine((source) => Object.keys(source).length > 0),
  mergedSource: z.string(),
  crossDeps: z
    .array(z.object({ library: z.string(), type: z.string(), items: z.array(z.string()) }))
    .optional(),
});

const hookSourceDataSchema = z.looseObject({
  source: sourceFileSchema,
  files: z.array(sourceFileWithPathSchema).optional(),
});

function isDocSourceData<T extends DocSourceType>(
  type: T,
  value: unknown,
): value is DocSourceDataByType[T] {
  const schema = type === "components" ? componentSourceDataSchema : hookSourceDataSchema;
  return schema.safeParse(value).success;
}

function handleMissingData(path: string, options: LoadDocDataOptions): null {
  if (options.throwIfMissing) {
    throw new Error(`Missing generated docs data: ${path}`);
  }
  return null;
}

export async function loadDocPageData<T extends keyof DocPageDataByType>(
  library: string,
  type: T,
  name: string | undefined,
  options: LoadDocDataOptions = {},
): Promise<DocPageDataByType[T] | null> {
  if (!hasSafeDocPath(library, name)) return null;

  const path = `${library}/${type}/${name}`;
  try {
    const mod: { default: DocPageDataByType[T] } = await import(
      `../generated/${library}/${type}/${name}.json`
    );
    return mod.default;
  } catch {
    return handleMissingData(path, options);
  }
}

export async function loadDocSourceData<T extends keyof DocSourceDataByType>(
  library: string,
  type: T,
  name: string | undefined,
  options: LoadDocDataOptions = {},
): Promise<DocSourceDataByType[T] | null> {
  if (!isDocsLibraryId(library) || !isDocSourceType(type) || !hasSafeDocPath(library, name)) {
    return null;
  }

  const path = `${library}/${type}/${name}.source`;
  const response = await fetch(
    `${import.meta.env.BASE_URL}source-data/${library}/${type}/${name}.source.json`,
  );
  if (!response.ok) {
    return handleMissingData(path, options);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Invalid generated docs data: ${path}`);
  }

  if (!isDocSourceData(type, data)) {
    throw new Error(`Invalid generated docs data: ${path}`);
  }

  return data;
}
