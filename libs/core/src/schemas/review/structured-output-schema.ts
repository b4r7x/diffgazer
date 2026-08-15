import { z } from "zod";
import { LensReviewResultSchema } from "./issues.js";

type JsonSchemaObject = Record<string, unknown>;

function isJsonSchemaObject(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableUnion(schema: unknown): unknown {
  if (!isJsonSchemaObject(schema)) return schema;

  const types = new Set<string>();
  if (typeof schema.type === "string") types.add(schema.type);
  if (Array.isArray(schema.anyOf)) {
    for (const entry of schema.anyOf) {
      if (isJsonSchemaObject(entry) && typeof entry.type === "string") {
        types.add(entry.type);
      }
    }
  }
  if (types.has("null")) return schema;

  return {
    anyOf: [schema, { type: "null" }],
  };
}

function adaptProviderSchema(
  schema: unknown,
  options: { includeAdditionalProperties: boolean },
): unknown {
  if (Array.isArray(schema)) {
    return schema.map((entry) => adaptProviderSchema(entry, options));
  }
  if (!isJsonSchemaObject(schema)) return schema;

  if (schema.type === "object" || isJsonSchemaObject(schema.properties)) {
    const propertyNames = Object.keys(schema.properties ?? {});
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter((entry): entry is string => typeof entry === "string")
        : [],
    );
    const properties: JsonSchemaObject = {};

    for (const name of propertyNames) {
      const propertySchema = (schema.properties as JsonSchemaObject)[name];
      const adapted = adaptProviderSchema(propertySchema, options);
      properties[name] = required.has(name) ? adapted : nullableUnion(adapted);
    }

    const next: JsonSchemaObject = {
      ...schema,
      properties,
      required: propertyNames,
    };

    if (options.includeAdditionalProperties) {
      next.additionalProperties = false;
    } else {
      delete next.additionalProperties;
    }
    delete next.$schema;
    return next;
  }

  const next: JsonSchemaObject = { ...schema };
  if (next.items !== undefined) {
    next.items = adaptProviderSchema(next.items, options);
  }
  for (const combinator of ["anyOf", "oneOf", "allOf"] as const) {
    const entries = next[combinator];
    if (Array.isArray(entries)) {
      next[combinator] = entries.map((entry) => adaptProviderSchema(entry, options));
    }
  }
  delete next.$schema;
  return next;
}

/** Canonical draft-07 projection used for admission hashing and CLI probes. */
export function buildLensReviewResultJsonSchema(): unknown {
  return z.toJSONSchema(LensReviewResultSchema, { target: "draft-7" });
}

/** OpenAI-compatible strict structured outputs: every property required, optionals nullable. */
export function toOpenAiStrictJsonSchema(schema: unknown): Record<string, unknown> {
  if (!isJsonSchemaObject(schema)) {
    throw new Error("Expected a JSON schema object");
  }
  return adaptProviderSchema(schema, { includeAdditionalProperties: true }) as Record<
    string,
    unknown
  >;
}

/** Gemini responseSchema subset: no draft-07 metadata or additionalProperties keywords. */
export function toGoogleResponseSchema(schema: unknown): Record<string, unknown> {
  if (!isJsonSchemaObject(schema)) {
    throw new Error("Expected a JSON schema object");
  }
  return adaptProviderSchema(schema, { includeAdditionalProperties: false }) as Record<
    string,
    unknown
  >;
}

/** Provider wire schema for hosted structured-output requests. */
export function buildProviderLensReviewResultJsonSchema(
  wireFamily: "openai-compatible" | "openrouter" | "google",
): Record<string, unknown> {
  const canonical = buildLensReviewResultJsonSchema();
  return wireFamily === "google"
    ? toGoogleResponseSchema(canonical)
    : toOpenAiStrictJsonSchema(canonical);
}
