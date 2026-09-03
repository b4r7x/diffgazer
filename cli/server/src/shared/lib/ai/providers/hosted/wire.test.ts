import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import { responseTimeoutDispatcher } from "./dispatcher.js";
import { evidenceKeyFor, TEST_CREDENTIAL } from "./execute.test-support.js";
import type { ReasoningEffort } from "./profiles.js";
import { buildRequestInit, parseProviderPayload } from "./wire.js";

const REASONING_EFFORT_TABLE: ReadonlyArray<[HostedApiProductId, string, ReasoningEffort]> = [
  ["opencode-zen", "qwen3.8-flash", "none"],
  ["opencode-zen", "glm-5.3-flash", "low"],
  ["opencode-zen", "deepseek-v4-flash", "none"],
  ["zai", "glm-5.3-flash", "low"],
];

const BODY_KEYS = {
  plain: ["model", "messages", "temperature", "stream", "response_format"],
  reasoning: ["model", "messages", "temperature", "stream", "response_format", "reasoning_effort"],
};

const MODELS_OUTSIDE_THE_TABLE: ReadonlyArray<[HostedApiProductId, string]> = [
  ["opencode-zen", "minimax-m2.5"],
  ["zai", "glm-4.5-air"],
  ["ollama-cloud", "gpt-oss:20b"],
  ["deepseek", "deepseek-v4-flash"],
];

describe("buildRequestInit", () => {
  const bodyOf = (
    productId: HostedApiProductId,
    modelId: string,
    boundReasoning?: boolean,
  ): Record<string, unknown> =>
    JSON.parse(
      String(
        buildRequestInit({
          productId,
          credential: TEST_CREDENTIAL,
          evidenceKey: evidenceKeyFor(productId, { modelId }),
          prompt: "review this diff",
          boundReasoning,
        }).body,
      ),
    );

  it("dispatches through the agent sized for the evidence key's wall and the profile's idle budget", () => {
    const evidenceKey = evidenceKeyFor("openrouter");

    const init = buildRequestInit({
      productId: "openrouter",
      credential: TEST_CREDENTIAL,
      evidenceKey,
      prompt: "review this diff",
    });

    // profiles.ts openrouter pacing: bodyIdleTimeoutMs: 360_000.
    expect((init as { dispatcher?: unknown }).dispatcher).toBe(
      responseTimeoutDispatcher(evidenceKey.limits.wallTimeMs, 360_000),
    );
  });

  it("dispatches a no-budget product through the wall-only agent", () => {
    const evidenceKey = evidenceKeyFor("zai");

    const init = buildRequestInit({
      productId: "zai",
      credential: TEST_CREDENTIAL,
      evidenceKey,
      prompt: "review this diff",
    });

    expect((init as { dispatcher?: unknown }).dispatcher).toBe(
      responseTimeoutDispatcher(evidenceKey.limits.wallTimeMs),
    );
  });

  it("dispatches opencode-zen through the agent bounded by its 120s idle budget", () => {
    const evidenceKey = evidenceKeyFor("opencode-zen");

    const init = buildRequestInit({
      productId: "opencode-zen",
      credential: TEST_CREDENTIAL,
      evidenceKey,
      prompt: "review this diff",
    });

    expect((init as { dispatcher?: unknown }).dispatcher).toBe(
      responseTimeoutDispatcher(evidenceKey.limits.wallTimeMs, 120_000),
    );
  });

  it.each(
    REASONING_EFFORT_TABLE,
  )("sends reasoning_effort to %s/%s: %s", (productId, modelId, effort) => {
    const body = bodyOf(productId, modelId);

    expect(body.reasoning_effort).toBe(effort);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0);
    expect(body.model).toBe(modelId);
    expect(Object.keys(body)).toEqual(BODY_KEYS.reasoning);
  });

  it.each(
    MODELS_OUTSIDE_THE_TABLE,
  )("sends no reasoning key to %s/%s (outside the table)", (productId, modelId) => {
    const body = bodyOf(productId, modelId);

    expect(body).not.toHaveProperty("reasoning_effort");
    expect(Object.keys(body)).toEqual(BODY_KEYS.plain);
  });

  it("leaves the openrouter branch alone", () => {
    const unbounded = bodyOf("openrouter", "z-ai/glm-5.3-flash");
    expect(unbounded).not.toHaveProperty("reasoning_effort");
    expect(unbounded).not.toHaveProperty("reasoning");

    const bounded = bodyOf("openrouter", "z-ai/glm-5.3-flash", true);
    expect(bounded.reasoning).toEqual({ max_tokens: 2048 });
    expect(bounded).not.toHaveProperty("reasoning_effort");
  });

  it("never sends a value the route is known to reject", () => {
    // Z.AI answers reasoning_effort "none" on a GLM route with HTTP 400 [1210];
    // Zen's deepseek-v4-flash stalls at "low".
    expect(bodyOf("zai", "glm-5.3-flash").reasoning_effort).not.toBe("none");
    expect(bodyOf("opencode-zen", "deepseek-v4-flash").reasoning_effort).not.toBe("low");

    const bodies = [
      ...REASONING_EFFORT_TABLE.map(([productId, modelId]) => bodyOf(productId, modelId)),
      ...MODELS_OUTSIDE_THE_TABLE.map(([productId, modelId]) => bodyOf(productId, modelId)),
      bodyOf("openrouter", "z-ai/glm-5.3-flash"),
      bodyOf("openrouter", "z-ai/glm-5.3-flash", true),
    ];

    for (const body of bodies) {
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain('"thinking"');
      expect(serialized).not.toContain('"enable_thinking"');
      expect(serialized).not.toContain('"reasoning":{"enabled"');
    }
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
