import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { responseTimeoutDispatcher } from "./dispatcher.js";
import {
  evidenceKeyFor,
  STRUCTURED_OUTPUT_SCHEMA,
  TEST_CREDENTIAL,
} from "./execute.test-support.js";
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
          sessionId: "ses_test",
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
      sessionId: "ses_test",
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
      sessionId: "ses_test",
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
      sessionId: "ses_test",
    });

    expect((init as { dispatcher?: unknown }).dispatcher).toBe(
      responseTimeoutDispatcher(evidenceKey.limits.wallTimeMs, 120_000),
    );
  });

  it("sends Command Code only the openai-compatible defaults with the strict schema and no reasoning key", () => {
    const init = buildRequestInit({
      productId: "commandcode",
      credential: TEST_CREDENTIAL,
      evidenceKey: evidenceKeyFor("commandcode"),
      prompt: "review this diff",
      sessionId: "ses_test",
      structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    });
    const body = JSON.parse(String(init.body));

    expect(Object.keys(body)).toEqual(BODY_KEYS.plain);
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0);
    expect(body.model).toBe("deepseek/deepseek-v4-flash");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "review_result", strict: true, schema: STRUCTURED_OUTPUT_SCHEMA },
    });
    expect(init.redirect).toBe("error");
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

describe("buildRequestInit OpenCode identification", () => {
  const headersOf = (productId: HostedApiProductId, sessionId: string): Record<string, string> =>
    buildRequestInit({
      productId,
      credential: TEST_CREDENTIAL,
      evidenceKey: evidenceKeyFor(productId),
      prompt: "review this diff",
      sessionId,
    }).headers as Record<string, string>;

  const BEARER_ONLY = {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${TEST_CREDENTIAL}`,
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("identifies this client and its conversation to OpenCode Zen", () => {
    vi.stubEnv("DIFFGAZER_CLIENT_VERSION", "0.2.0");

    const headers = headersOf("opencode-zen", "ses_review-1");

    expect(headers).toMatchObject({
      "user-agent": "diffgazer/0.2.0",
      "x-opencode-client": "diffgazer",
      "x-opencode-session": "ses_review-1",
    });
    expect(headers["x-opencode-request"]).toMatch(/^req_/);
    expect(headers["x-opencode-request"]).not.toBe(
      headersOf("opencode-zen", "ses_review-1")["x-opencode-request"],
    );
  });

  it("reports the dev placeholder version when the binary did not export one", () => {
    vi.stubEnv("DIFFGAZER_CLIENT_VERSION", "");

    expect(headersOf("opencode-zen", "ses_review-1")["user-agent"]).toBe("diffgazer/0.0.0-dev");
  });

  it.each([
    ["zai", BEARER_ONLY],
    ["ollama-cloud", BEARER_ONLY],
    ["deepseek", BEARER_ONLY],
    ["commandcode", BEARER_ONLY],
    [
      "openrouter",
      { ...BEARER_ONLY, "http-referer": "https://diffgazer.local", "x-title": "Diffgazer" },
    ],
    [
      "gemini",
      {
        "content-type": "application/json",
        accept: "application/json",
        "x-goog-api-key": TEST_CREDENTIAL,
      },
    ],
  ] as const)("does not identify itself to %s (no opencode headers, no user agent)", (productId, expected) => {
    expect(headersOf(productId, "ses_review-1")).toEqual(expected);
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

describe("parseProviderPayload usage from Command Code upstreams", () => {
  const P2_BODY = {
    id: "f057f1df9c23440ebf361470e9510285",
    object: "chat.completion",
    created: 1788971171,
    model: "meituan/LongCat-2.0:free",
    choices: [
      {
        delta: null,
        index: 0,
        finish_reason: "stop",
        matched_stop: 2,
        message: {
          role: "assistant",
          content: "OK",
          reasoning_content:
            '\nWe are asked: "Reply with the single word OK." So I need to output just "OK".',
        },
        logprobs: null,
      },
    ],
    usage: {
      completion_tokens: 26,
      prompt_tokens: 14,
      total_tokens: 40,
      completion_tokens_details: { reasoning_tokens: 22 },
      prompt_tokens_details: {
        cached_tokens: 0,
        audio_tokens: 0,
        image_tokens: 0,
        video_tokens: 0,
        text_tokens: 0,
        cache_write_tokens: 0,
      },
    },
    lastOne: false,
  };

  const P4_BODY = {
    id: "gen_01M23FWGYGEXJHSSSGD24P2VEZ",
    object: "chat.completion",
    created: 1788971207,
    model: "deepseek/deepseek-v4-flash",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "OK",
          reasoning: "We need to reply with single word OK.",
          reasoning_details: [
            {
              type: "reasoning.text",
              text: "We need to reply with single word OK.",
              format: "unknown",
              index: 0,
            },
          ],
        },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 90,
      completion_tokens: 11,
      total_tokens: 101,
      prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0, video_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 9, image_tokens: 0 },
      cache_creation_input_tokens: 0,
    },
    system_fingerprint: "fp_cw64mrvlvr",
  };

  it.each([
    [
      "LongCat",
      P2_BODY,
      {
        inputTokens: 14,
        outputTokens: 26,
        totalTokens: 40,
        cachedTokens: 0,
        reasoningTokens: 22,
      },
    ],
    [
      "deepseek",
      P4_BODY,
      {
        inputTokens: 90,
        outputTokens: 11,
        totalTokens: 101,
        cachedTokens: 0,
        reasoningTokens: 9,
      },
    ],
  ])("maps %s usage and content", (_name, body, expected) => {
    const parsed = parseProviderPayload("commandcode", body);
    expect(parsed.content).toBe("OK");
    expect(parsed.usage).toEqual(expected);
    expect(parsed.finishReason).toBe("stop");
    expect(parsed.choiceError).toBeNull();
  });
});
