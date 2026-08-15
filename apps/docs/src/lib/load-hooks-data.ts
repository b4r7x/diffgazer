import { z } from "zod";
import {
  highlightedLinesSchema,
  hookDocsSchema,
  sourceFileSchema,
  sourceFileWithPathSchema,
} from "./doc-data-schemas";
import type { HookData, HookDataMap } from "./generated-doc-data";

const hookDataSchema: z.ZodType<HookData> = z.looseObject({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  source: sourceFileSchema,
  files: z.array(sourceFileWithPathSchema).optional(),
  docs: hookDocsSchema.nullable().default(null),
  usageSnippet: z.string().optional(),
  usageSnippetHighlighted: highlightedLinesSchema.optional(),
  examples: z.array(z.string()).default([]),
  exampleSource: z.record(z.string(), sourceFileSchema).default({}),
});

const libraryHooksSchema = z.record(z.string(), hookDataSchema);

const libraryHooksLoaders: Record<string, () => Promise<unknown>> = {
  ui: () => import("@/generated/ui/ui-hooks.json").then((mod) => mod.default),
  keys: () => import("@/generated/keys/keys-hooks.json").then((mod) => mod.default),
};

const libraryHooksCache = new Map<string, Promise<HookDataMap>>();

export function loadLibraryHooksData(library: string): Promise<HookDataMap> {
  const cached = libraryHooksCache.get(library);
  if (cached) return cached;

  const loader = libraryHooksLoaders[library];
  if (!loader) {
    return Promise.resolve({});
  }

  const promise = loader().then((rawHooksData) => {
    const parsed = libraryHooksSchema.safeParse(rawHooksData);
    if (!parsed.success) {
      throw new Error(`Invalid generated docs data: hooksData.${library}: ${parsed.error.message}`);
    }
    return parsed.data;
  });
  libraryHooksCache.set(library, promise);
  void promise.catch(() => {
    if (libraryHooksCache.get(library) === promise) libraryHooksCache.delete(library);
  });
  return promise;
}
