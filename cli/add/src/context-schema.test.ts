import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildConfigJsonSchema, SCHEMA_OUTPUT_PATH } from "./config-schema.js";

function readCommittedSchema(): unknown {
  return JSON.parse(readFileSync(SCHEMA_OUTPUT_PATH, "utf8"));
}

describe("published editor schema parity", () => {
  test("committed diffgazer.json matches the schema generated from the zod contract", () => {
    expect(
      readCommittedSchema(),
      "apps/docs/public/schema/diffgazer.json is out of sync with the zod contract. " +
        "Regenerate and format it: pnpm --filter @diffgazer/add generate:schema",
    ).toEqual(buildConfigJsonSchema());
  });

  test("schema does not reject unknown keys (zod strips, it must not assert false)", () => {
    const schema = buildConfigJsonSchema();
    expect(schema.additionalProperties).not.toBe(false);
  });
});
