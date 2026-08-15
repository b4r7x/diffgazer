import type { CodeBlockLineProps } from "@diffgazer/ui/components/code-block";
import { z } from "zod";

const codeBlockTokenSchema = z.looseObject({
  text: z.string(),
  color: z.string().optional(),
  className: z.string().optional(),
});

const codeBlockLineSchema = z.looseObject({
  number: z.number().optional(),
  content: z.union([z.string(), z.array(codeBlockTokenSchema)]).optional(),
  state: z.enum(["highlight", "added", "removed"]).optional(),
});

// CodeBlockLineProps extends span props, so it cannot be expressed as a zod object
// type directly; validate the generated fields and keep the component's prop type.
export const highlightedLinesSchema = z.custom<CodeBlockLineProps[]>(
  (value) => z.array(codeBlockLineSchema).safeParse(value).success,
  { error: "Expected highlighted code lines" },
);

export const sourceFileSchema = z.object({
  raw: z.string(),
  highlighted: highlightedLinesSchema,
});

export const sourceFileWithPathSchema = sourceFileSchema.extend({
  path: z.string(),
});

const hookDocParameterSchema = z.looseObject({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string(),
  defaultValue: z.string().optional(),
});

export const hookDocsSchema = z.looseObject({
  description: z.string().optional(),
  usage: z
    .looseObject({
      code: z.string().optional(),
      example: z.string().optional(),
      lang: z.string().optional(),
    })
    .optional(),
  parameters: z.array(hookDocParameterSchema).optional(),
  returns: z
    .looseObject({
      type: z.string(),
      description: z.string(),
      properties: z.array(hookDocParameterSchema).optional(),
    })
    .optional(),
  notes: z.array(z.looseObject({ title: z.string(), content: z.string() })).optional(),
  examples: z.array(z.looseObject({ name: z.string(), title: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
});
