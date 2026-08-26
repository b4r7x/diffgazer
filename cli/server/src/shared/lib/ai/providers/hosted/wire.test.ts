import { describe, expect, it } from "vitest";
import { parseProviderPayload } from "./wire.js";

describe("parseProviderPayload finishReason", () => {
  it("extracts finish_reason from an openai-compatible payload", () => {
    const parsed = parseProviderPayload("zai", {
      choices: [{ message: { content: "" }, finish_reason: "length" }],
      usage: {
        completion_tokens: 4000,
        completion_tokens_details: { reasoning_tokens: 4000 },
      },
    });
    expect(parsed.finishReason).toBe("length");
    expect(parsed.usage?.reasoningTokens).toBe(4000);
  });

  it("extracts finishReason from a google payload", () => {
    const parsed = parseProviderPayload("gemini", {
      candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }],
    });
    expect(parsed.finishReason).toBe("MAX_TOKENS");
  });

  it("returns null when the field is absent", () => {
    expect(
      parseProviderPayload("zai", {
        choices: [{ message: { content: '{"issues":[]}' } }],
      }).finishReason,
    ).toBeNull();
    expect(parseProviderPayload("gemini", { candidates: [] }).finishReason).toBeNull();
  });
});
