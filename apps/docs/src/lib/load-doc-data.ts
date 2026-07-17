import type { CodeBlockLineProps, CodeBlockToken } from "@diffgazer/ui/components/code-block";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyTokenFields(value: Record<string, unknown>): boolean {
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    if (key !== "text" && key !== "color" && key !== "className") return false;
  }
  return true;
}

function isCodeBlockToken(value: unknown): value is CodeBlockToken {
  return (
    isRecord(value) &&
    hasOnlyTokenFields(value) &&
    typeof value.text === "string" &&
    (value.color === undefined || typeof value.color === "string") &&
    (value.className === undefined || typeof value.className === "string")
  );
}

function isCodeBlockContent(value: unknown): value is CodeBlockLineProps["content"] {
  if (value === undefined || typeof value === "string") return true;
  if (!Array.isArray(value)) return false;
  for (const token of value) {
    if (!isCodeBlockToken(token)) return false;
  }
  return true;
}

function hasOnlyLineFields(value: Record<string, unknown>): boolean {
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    if (key !== "number" && key !== "content" && key !== "state") return false;
  }
  return true;
}

function isCodeBlockLine(value: unknown): value is CodeBlockLineProps {
  if (!isRecord(value) || !hasOnlyLineFields(value)) return false;
  if (
    value.number !== undefined &&
    (typeof value.number !== "number" || !Number.isFinite(value.number))
  ) {
    return false;
  }
  if (!isCodeBlockContent(value.content)) return false;

  return (
    value.state === undefined ||
    value.state === "highlight" ||
    value.state === "added" ||
    value.state === "removed"
  );
}

function isHighlightedSource(value: unknown): value is CodeBlockLineProps[] {
  if (!Array.isArray(value)) return false;
  for (const line of value) {
    if (!isCodeBlockLine(line)) return false;
  }
  return true;
}

function isSourceFile(
  value: unknown,
): value is ComponentSourceData["source"][string] | HookSourceData["source"] {
  return isRecord(value) && typeof value.raw === "string" && isHighlightedSource(value.highlighted);
}

function isSourceFileWithPath(value: unknown): boolean {
  return isRecord(value) && typeof value.path === "string" && isSourceFile(value);
}

function hasValidCrossDeps(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;

  return value.every(
    (dependency) =>
      isRecord(dependency) &&
      typeof dependency.library === "string" &&
      typeof dependency.type === "string" &&
      Array.isArray(dependency.items) &&
      dependency.items.every((item) => typeof item === "string"),
  );
}

function isComponentSourceData(value: unknown): value is ComponentSourceData {
  if (!isRecord(value) || !isRecord(value.source) || typeof value.mergedSource !== "string") {
    return false;
  }

  let hasSourceFile = false;
  for (const path in value.source) {
    if (!Object.hasOwn(value.source, path)) continue;
    hasSourceFile = true;
    if (!isSourceFile(value.source[path])) return false;
  }

  return hasSourceFile && hasValidCrossDeps(value.crossDeps);
}

function isHookSourceData(value: unknown): value is HookSourceData {
  if (!isRecord(value) || !isSourceFile(value.source)) return false;
  if (value.files === undefined) return true;
  if (!Array.isArray(value.files)) return false;
  return value.files.every(isSourceFileWithPath);
}

function isDocSourceData<T extends DocSourceType>(
  type: T,
  value: unknown,
): value is DocSourceDataByType[T] {
  return type === "components" ? isComponentSourceData(value) : isHookSourceData(value);
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
