import { describe, expect, it } from "vitest";
import { sha256CanonicalJsonSync } from "../canonical-json.js";
import {
  buildLensReviewResultJsonSchema,
  buildProviderLensReviewResultJsonSchema,
  toGoogleResponseSchema,
  toOpenAiStrictJsonSchema,
} from "./structured-output-schema.js";

function issueSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties as Record<string, unknown> | undefined;
  const issues = properties?.issues as Record<string, unknown> | undefined;
  const items = issues?.items as Record<string, unknown> | undefined;
  if (!items) throw new Error("Expected issues.items schema");
  return items;
}

function evidenceItemSchema(issue: Record<string, unknown>): Record<string, unknown> {
  const properties = issue.properties as Record<string, unknown> | undefined;
  const evidence = properties?.evidence as Record<string, unknown> | undefined;
  const items = evidence?.items as Record<string, unknown> | undefined;
  if (!items) throw new Error("Expected evidence.items schema");
  return items;
}

describe("structured output schema dialect", () => {
  const canonical = buildLensReviewResultJsonSchema() as Record<string, unknown>;

  it("keeps the canonical draft-07 projection for admission hashing", () => {
    expect(canonical.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(issueSchema(canonical).required).not.toContain("fixPlan");
  });

  it("requires every issue property in the OpenAI strict dialect with nullable optionals", () => {
    const schema = toOpenAiStrictJsonSchema(canonical);
    const issue = issueSchema(schema);

    expect(schema.$schema).toBeUndefined();
    expect(issue.additionalProperties).toBe(false);
    expect(issue.required).toEqual(
      expect.arrayContaining(["fixPlan", "betterOptions", "testsToAdd", "trace"]),
    );

    for (const optional of ["fixPlan", "betterOptions", "testsToAdd", "trace"] as const) {
      const properties = issue.properties as Record<string, unknown>;
      const property = properties[optional] as Record<string, unknown>;
      expect(property.anyOf).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "null" })]),
      );
    }

    const evidence = evidenceItemSchema(issue);
    expect(evidence.required).toEqual(expect.arrayContaining(["file", "range", "sha"]));
    for (const optional of ["file", "range", "sha"] as const) {
      const properties = evidence.properties as Record<string, unknown>;
      const property = properties[optional] as Record<string, unknown>;
      expect(property.anyOf).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "null" })]),
      );
    }
  });

  it("projects the provider-lenient string lists as plain string arrays", () => {
    const stringList = { type: "array", items: { type: "string" } };
    const properties = issueSchema(canonical).properties as Record<string, unknown>;
    const strictProperties = issueSchema(toOpenAiStrictJsonSchema(canonical)).properties as Record<
      string,
      unknown
    >;

    for (const list of ["betterOptions", "testsToAdd"] as const) {
      expect(properties[list]).toStrictEqual(stringList);
      expect(strictProperties[list]).toStrictEqual({ anyOf: [stringList, { type: "null" }] });
    }
  });

  it("hashes to the value every recorded admission tuple carries", () => {
    // STRUCTURED_OUTPUT_SCHEMA_SHA256 (cli/server admission/protocol.ts) is this
    // hash of the canonical projection; the lenient provider reads are
    // z.preprocess constructs precisely so it does not move.
    expect(sha256CanonicalJsonSync(canonical)).toBe(
      "26ae0b23ec858ae7c35f1c50efc556af158dfab5325d382c227afe7476b5db86",
    );
  });

  it("drops draft-07-only keywords for the Google responseSchema dialect", () => {
    const schema = toGoogleResponseSchema(canonical);
    const issue = issueSchema(schema);

    expect(schema.$schema).toBeUndefined();
    expect(schema.additionalProperties).toBeUndefined();
    expect(issue.additionalProperties).toBeUndefined();
    expect(issue.required).toEqual(
      expect.arrayContaining(["fixPlan", "betterOptions", "testsToAdd", "trace"]),
    );
  });

  it("carries the suggested_patch format contract into every wire dialect", () => {
    for (const schema of [
      canonical,
      buildProviderLensReviewResultJsonSchema("openai-compatible"),
      buildProviderLensReviewResultJsonSchema("google"),
    ]) {
      const properties = issueSchema(schema as Record<string, unknown>).properties as Record<
        string,
        unknown
      >;
      const patch = properties.suggested_patch as Record<string, unknown>;
      expect(patch.description).toContain('numbered hunk headers like "@@ -2,3 +2,8 @@"');
      expect(patch.description).toContain("never flattened onto one line");
    }
  });

  it("selects the wire dialect for hosted provider families", () => {
    const openAi = buildProviderLensReviewResultJsonSchema("openai-compatible");
    const google = buildProviderLensReviewResultJsonSchema("google");

    expect(issueSchema(openAi).additionalProperties).toBe(false);
    expect(issueSchema(google).additionalProperties).toBeUndefined();
  });
});
