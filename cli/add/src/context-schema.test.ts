import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildConfigJsonSchema, SCHEMA_OUTPUT_PATH } from "./config-schema.js";
import { DiffgazerAddConfigSchema } from "./context.js";

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
    expect([undefined, true]).toContain(schema.additionalProperties);
  });
});

describe("dgadd config CSS chunk hashes", () => {
  test.each([
    "../../outside",
    "ABCDEF0123456789",
    "abcdef012345678",
    "abcdef01234567890",
  ])("rejects non-canonical hash %s", (hash) => {
    const result = DiffgazerAddConfigSchema.safeParse({
      installedComponents: {
        "ui/dialog": { installedAt: "2026-07-15T00:00:00.000Z", cssChunks: [hash] },
      },
    });

    expect(result.success).toBe(false);
  });

  test("accepts exactly sixteen lowercase hexadecimal characters", () => {
    const result = DiffgazerAddConfigSchema.safeParse({
      installedComponents: {
        "ui/dialog": {
          installedAt: "2026-07-15T00:00:00.000Z",
          cssChunks: ["abcdef0123456789"],
        },
      },
    });

    expect(result.success).toBe(true);
  });
});
