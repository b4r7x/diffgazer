import { resolve } from "node:path";
import { z } from "zod";
import { DiffgazerAddConfigSchema } from "./context.js";

/**
 * Single source of truth for the published editor schema. The committed file at
 * apps/docs/public/schema/diffgazer.json is generated from the same zod contract
 * `dgadd` validates against, so the JSON Schema cannot drift from the runtime
 * config shape.
 */
const SCHEMA_ID = "https://r.b4r7.dev/schema/diffgazer.json";

export function buildConfigJsonSchema(): Record<string, unknown> {
  // io: "input" so the schema mirrors what `dgadd` accepts when reading a config
  // the user authors: the zod contract is a looseObject, so unknown keys are
  // accepted AND preserved across rewrites, and the schema must not assert
  // additionalProperties: false.
  const body = z.toJSONSchema(DiffgazerAddConfigSchema, { target: "draft-7", io: "input" });
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: SCHEMA_ID,
    title: "Diffgazer Installer Config",
    ...body,
  };
}

export function serializeConfigJsonSchema(): string {
  return `${JSON.stringify(buildConfigJsonSchema(), null, 2)}\n`;
}

export const SCHEMA_OUTPUT_PATH = resolve(
  import.meta.dirname,
  "../../../apps/docs/public/schema/diffgazer.json",
);
