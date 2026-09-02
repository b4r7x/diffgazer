import { describe, expect, it } from "vitest";
import { responseTimeoutDispatcher } from "./dispatcher.js";
import { evidenceKeyFor, TEST_CREDENTIAL } from "./execute.test-support.js";
import { buildRequestInit, parseProviderPayload } from "./wire.js";

describe("buildRequestInit", () => {
  it("dispatches through the agent sized for the evidence key's wall", () => {
    const evidenceKey = evidenceKeyFor("openrouter");

    const init = buildRequestInit({
      productId: "openrouter",
      credential: TEST_CREDENTIAL,
      evidenceKey,
      prompt: "review this diff",
    });

    expect((init as { dispatcher?: unknown }).dispatcher).toBe(
      responseTimeoutDispatcher(evidenceKey.limits.wallTimeMs),
    );
  });
});

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
