import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { HookPageData } from "../../src/lib/generated-doc-data.ts";
import {
  type PreparedScaffoldData,
  type PreparedSourceFile,
  prepareComponentScaffoldData,
  prepareHookScaffoldData,
} from "../../src/lib/scaffold-data.ts";
import type { ComponentPageData } from "../../src/types/data.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DOCS_ROOT = resolve(HERE, "../..");

const codeTokenSchema = z
  .object({
    text: z.string(),
    color: z.string().optional(),
    className: z.string().optional(),
  })
  .strict();

const codeLineSchema = z
  .object({
    number: z.number().finite(),
    content: z.array(codeTokenSchema),
    state: z.enum(["highlight", "added", "removed"]).optional(),
  })
  .strict();

const sourceFileSchema = z
  .object({
    raw: z.string(),
    highlighted: z.array(codeLineSchema),
  })
  .strict();

const sourceFileWithPathSchema = sourceFileSchema.extend({ path: z.string().min(1) }).strict();

const exampleRefSchema = z.object({ name: z.string(), title: z.string() }).strict();
const noteSchema = z.object({ title: z.string(), content: z.string() }).strict();
const usageSchema = z
  .object({
    code: z.string().optional(),
    example: z.string().optional(),
    lang: z.enum(["tsx", "typescript", "css", "bash", "json", "html"]).optional(),
  })
  .strict();
const hookParameterSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
    defaultValue: z.string().optional(),
  })
  .strict();
const hookReturnSchema = z
  .object({
    type: z.string(),
    description: z.string(),
    properties: z.array(hookParameterSchema).optional(),
  })
  .strict();
const hookDocsSchema = z
  .object({
    description: z.string().optional(),
    usage: usageSchema.optional(),
    parameters: z.array(hookParameterSchema).optional(),
    returns: hookReturnSchema.optional(),
    notes: z.array(noteSchema).optional(),
    examples: z.array(exampleRefSchema).optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict();
const hookPageDataSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    description: z.string(),
    docs: hookDocsSchema.nullable(),
    usageSnippet: z.string().optional(),
    usageSnippetHighlighted: z.array(codeLineSchema).optional(),
    examples: z.array(z.string()),
    exampleSource: z.record(z.string(), sourceFileSchema),
    parameters: z.array(hookParameterSchema).optional(),
    returns: hookReturnSchema.optional(),
    files: z.array(z.string().min(1)).optional(),
  })
  .strict();

const componentPropSchema = z
  .object({
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
    description: z.string(),
  })
  .strict();
const componentDocsSchema = z
  .object({
    description: z.string().optional(),
    usage: usageSchema.optional(),
    notes: z.array(noteSchema).optional(),
    examples: z.array(exampleRefSchema).optional(),
    anatomy: z
      .array(
        z
          .object({ name: z.string(), indent: z.number().int(), note: z.string().optional() })
          .strict(),
      )
      .optional(),
    keyboard: z
      .object({
        description: z.string(),
        keys: z.array(z.object({ keys: z.string(), action: z.string() }).strict()).optional(),
        examples: z.array(exampleRefSchema),
      })
      .strict()
      .nullable()
      .optional(),
    dataAttributes: z
      .array(
        z
          .object({
            attribute: z.string(),
            appliesTo: z.string(),
            values: z.string(),
            description: z.string(),
          })
          .strict(),
      )
      .optional(),
    cssVariables: z
      .array(
        z
          .object({
            name: z.string(),
            description: z.string(),
            defaultValue: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    tags: z.array(z.string()).optional(),
    props: z.record(z.string(), z.record(z.string(), componentPropSchema)).optional(),
    companionExamples: z.array(z.string()).optional(),
    noProps: z.boolean().optional(),
  })
  .strict();
const crossDependencySchema = z
  .object({
    library: z.string(),
    type: z.string(),
    items: z.array(z.string()),
  })
  .strict();
const componentPageDataSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    description: z.string(),
    dependencies: z.array(z.string()),
    files: z.array(z.string().min(1)),
    props: z.record(z.string(), z.record(z.string(), componentPropSchema)),
    usageSnippet: z.string(),
    usageSnippetHighlighted: z.array(codeLineSchema),
    examples: z.array(z.string()),
    exampleSource: z.record(z.string(), sourceFileSchema),
    docs: componentDocsSchema.nullable(),
    crossDeps: z.array(crossDependencySchema).optional(),
  })
  .strict();

const componentSourceArchiveSchema = z
  .object({
    source: z
      .record(z.string().min(1), sourceFileSchema)
      .refine((source) => Object.keys(source).length > 0, "source archive must not be empty"),
    mergedSource: z.string(),
    crossDeps: z.array(crossDependencySchema).optional(),
  })
  .strict();
const hookSourceArchiveSchema = z
  .object({
    source: sourceFileSchema,
    files: z.array(sourceFileWithPathSchema).optional(),
  })
  .strict();

function parseArtifact<T>(path: string, value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid generated docs data: ${path}: ${result.error.message}`);
  }
  return result.data;
}

function readJsonArtifact(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid generated docs data: ${path}: ${detail}`);
  }
}

export function parseScaffoldPageArtifact(
  type: "components" | "hooks",
  value: unknown,
  artifactPath: string,
): ComponentPageData | HookPageData {
  if (type === "components") {
    return parseArtifact(artifactPath, value, componentPageDataSchema) as ComponentPageData;
  }
  return parseArtifact(artifactPath, value, hookPageDataSchema) as HookPageData;
}

export function parseScaffoldSourceArtifact(
  type: "components" | "hooks",
  value: unknown,
  artifactPath: string,
): PreparedSourceFile[] {
  if (type === "components") {
    const archive = parseArtifact(artifactPath, value, componentSourceArchiveSchema);
    return Object.entries(archive.source).map(([path, source]) => ({ path, raw: source.raw }));
  }

  const archive = parseArtifact(artifactPath, value, hookSourceArchiveSchema);
  return (archive.files ?? []).map((file) => ({ path: file.path, raw: file.raw }));
}

function readPreparedSourceFiles(
  library: "keys" | "ui",
  type: "components" | "hooks",
  name: string,
): PreparedSourceFile[] {
  const archivePath = resolve(
    DOCS_ROOT,
    "public/source-data",
    library,
    type,
    `${name}.source.json`,
  );
  if (!existsSync(archivePath)) {
    throw new Error(`Missing generated docs data: ${archivePath}`);
  }
  return parseScaffoldSourceArtifact(type, readJsonArtifact(archivePath), archivePath);
}

export function loadPreparedScaffoldData(path: string): PreparedScaffoldData | null {
  const match = /^\/(ui|keys)\/(components|hooks)\/([a-z0-9-]+)$/.exec(path);
  if (!match) return null;
  const library = match[1];
  const type = match[2];
  const name = match[3];
  if ((library !== "ui" && library !== "keys") || !type || !name) return null;
  if (type !== "components" && type !== "hooks") return null;

  const dataPath = resolve(DOCS_ROOT, "src/generated", library, type, `${name}.json`);
  if (!existsSync(dataPath)) return null;

  const data = parseScaffoldPageArtifact(type, readJsonArtifact(dataPath), dataPath);
  const sourceFiles = readPreparedSourceFiles(library, type, name);
  if (type === "components") {
    return prepareComponentScaffoldData(library, data as ComponentPageData, sourceFiles);
  }
  return prepareHookScaffoldData(library, data as HookPageData, sourceFiles);
}
