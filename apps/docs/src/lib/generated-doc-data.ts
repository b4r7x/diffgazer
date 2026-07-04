import type { CodeBlockLineProps } from "@diffgazer/ui/components/code-block";
import { z } from "zod";
import { hooksData as rawHooksData, libsData as rawLibsData } from "@/generated/library-data";

const highlightedLinesSchema = z.custom<CodeBlockLineProps[]>((value) => Array.isArray(value), {
  error: "Expected highlighted code lines",
});

const sourceFileSchema = z.object({
  raw: z.string(),
  highlighted: highlightedLinesSchema,
});

const sourceFileWithPathSchema = sourceFileSchema.extend({
  path: z.string(),
});

const hookDocParameterSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string(),
    defaultValue: z.string().optional(),
  })
  .passthrough();

const hookDocsSchema = z
  .object({
    description: z.string().optional(),
    usage: z
      .object({
        code: z.string().optional(),
        example: z.string().optional(),
        lang: z.string().optional(),
      })
      .passthrough()
      .optional(),
    parameters: z.array(hookDocParameterSchema).optional(),
    returns: z
      .object({
        type: z.string(),
        description: z.string(),
        properties: z.array(hookDocParameterSchema).optional(),
      })
      .passthrough()
      .optional(),
    notes: z.array(z.object({ title: z.string(), content: z.string() }).passthrough()).optional(),
    examples: z.array(z.object({ name: z.string(), title: z.string() }).passthrough()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

type SourceFile = z.infer<typeof sourceFileSchema>;
type SourceFileWithPath = z.infer<typeof sourceFileWithPathSchema>;
type HookDocs = z.infer<typeof hookDocsSchema>;

export interface HookData {
  name: string;
  title: string;
  description: string;
  source: SourceFile;
  files?: SourceFileWithPath[];
  docs: HookDocs | null;
  usageSnippet?: string;
  usageSnippetHighlighted?: CodeBlockLineProps[];
  examples: string[];
  exampleSource: Record<string, SourceFile>;
}

export type HookDataMap = Record<string, HookData>;
export type SourceDataEntry = { source: SourceFile };
export type SourceDataMap = Record<string, SourceDataEntry>;

const sourceDataEntrySchema: z.ZodType<SourceDataEntry> = z
  .object({
    source: sourceFileSchema,
  })
  .passthrough();

const hookDataSchema: z.ZodType<HookData> = z
  .object({
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
  })
  .passthrough();

const hooksDataSchema = z.record(z.string(), z.record(z.string(), hookDataSchema));
const sourceDataSchema = z.record(z.string(), z.record(z.string(), sourceDataEntrySchema));

function parseGeneratedData<T>(label: string, value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid generated docs data: ${label}: ${result.error.message}`);
  }
  return result.data;
}

export const hooksData = parseGeneratedData("hooksData", rawHooksData, hooksDataSchema);
export const libsData = parseGeneratedData("libsData", rawLibsData, sourceDataSchema);
