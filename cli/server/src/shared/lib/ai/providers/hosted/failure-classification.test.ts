import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import { describeExhaustedRateLimit, describeHttpFailure } from "./failure-classification.js";

const BOUND_TO_GO = { poolLabel: "OpenCode Go" } as const;
const GO_WITH_ZEN_SIBLING = { poolLabel: "OpenCode Go", siblingLabel: "OpenCode Zen" } as const;

describe("pool-aware failure copy", () => {
  it("names the bound pool instead of the product on a 402", () => {
    expect(describeHttpFailure("opencode-zen", 402, BOUND_TO_GO).message).toBe(
      "OpenCode Go reported billing or quota exhausted (HTTP 402).",
    );
  });

  it("keeps the pacing remediation on a plain 429 even when a sibling pool is offered", () => {
    const failure = describeHttpFailure("opencode-zen", 429, GO_WITH_ZEN_SIBLING);

    expect(failure.message).toBe("OpenCode Go rate limited the request (HTTP 429).");
    expect(failure.remediation).toBe(
      "Wait and retry. If Agent Execution is set to Parallel, switching it to Sequential can help.",
    );
  });

  // The four pool refusals have four different fixes; only the Select Model
  // clause is shared, and only when the other pool actually serves the model.
  const DISTINCT_REMEDIES: ReadonlyArray<[number, string, string]> = [
    [
      404,
      "Choose a model this pool serves.",
      "Choose a model this pool serves, or switch to OpenCode Zen in Select Model.",
    ],
    [
      402,
      "Check the plan for this pool.",
      "Check the plan for this pool, or switch to OpenCode Zen in Select Model.",
    ],
    [
      403,
      "The key may not be entitled to this pool. Check the account.",
      "The key may not be entitled to this pool. Check the account, or switch to OpenCode Zen in Select Model.",
    ],
  ];

  it.each(
    DISTINCT_REMEDIES,
  )("%i names its own fix, and the switch only when the sibling serves the model", (status, alone, withSibling) => {
    expect(describeHttpFailure("opencode-zen", status, BOUND_TO_GO).remediation).toBe(alone);
    expect(describeHttpFailure("opencode-zen", status, GO_WITH_ZEN_SIBLING).remediation).toBe(
      withSibling,
    );
  });

  it("blames only the model on a pool 404, since the pool's own endpoint answered", () => {
    expect(describeHttpFailure("opencode-zen", 404, BOUND_TO_GO).message).toBe(
      "OpenCode Go could not find the selected model (HTTP 404).",
    );
  });

  it("calls an exhausted pool an allowance and offers the switch", () => {
    const failure = describeExhaustedRateLimit("opencode-zen", GO_WITH_ZEN_SIBLING);

    expect(failure.message).toBe(
      "OpenCode Go reported the account's allowance is exhausted (HTTP 429).",
    );
    expect(failure.remediation).toBe(
      "Check the allowance for this pool, or switch to OpenCode Zen in Select Model.",
    );
    expect(describeExhaustedRateLimit("opencode-zen", BOUND_TO_GO).remediation).toBe(
      "Check the allowance for this pool.",
    );
  });

  // One credential serves both pools, so 401 names the product even when the
  // configuration is bound to a pool.
  it("leaves the credential rejection a product-level fact", () => {
    const failure = describeHttpFailure("opencode-zen", 401, GO_WITH_ZEN_SIBLING);

    expect(failure.message).toBe("OpenCode Zen rejected the credential (HTTP 401).");
    expect(failure.remediation).toBe("Update the configuration with a valid API key.");
  });
});

describe("copy without pool options", () => {
  const PRODUCT_NAMES: ReadonlyArray<[HostedApiProductId, string]> = [
    ["opencode-zen", "OpenCode Zen"],
    ["deepseek", "DeepSeek"],
    ["openrouter", "OpenRouter"],
    ["zai", "Z.AI"],
    ["gemini", "Google Gemini"],
    ["qwen", "Qwen International"],
    ["moonshot", "Moonshot Open Platform"],
    ["minimax", "MiniMax International"],
    ["ollama-cloud", "Ollama Cloud"],
  ];

  const EXPECTED_BY_STATUS: ReadonlyArray<[number, string, string | undefined]> = [
    [
      400,
      "rejected the request as invalid (HTTP 400).",
      "Often the diff is too large for the model's context window. Reduce the review scope, or choose a model with a larger context.",
    ],
    [401, "rejected the credential (HTTP 401).", "Update the configuration with a valid API key."],
    [
      403,
      "refused access (HTTP 403).",
      "Check the API key and the account's access to the selected model.",
    ],
    [
      402,
      "reported billing or quota exhausted (HTTP 402).",
      "Check the account balance or plan, or change the model.",
    ],
    [404, "could not find the selected model or endpoint (HTTP 404).", "Select a different model."],
    [
      413,
      "rejected the request as too large (HTTP 413).",
      "Reduce the review scope, or change the model or plan.",
    ],
    [
      429,
      "rate limited the request (HTTP 429).",
      "Wait and retry. If Agent Execution is set to Parallel, switching it to Sequential can help.",
    ],
    [503, "returned HTTP 503.", undefined],
  ];

  const cases = PRODUCT_NAMES.flatMap(([productId, name]) =>
    EXPECTED_BY_STATUS.map(
      ([status, suffix, remediation]) =>
        [productId, status, `${name} ${suffix}`, remediation] as const,
    ),
  );

  it.each(
    cases,
  )("%s / %i keeps today's product-named copy", (productId, status, message, remediation) => {
    const failure = describeHttpFailure(productId, status);

    expect(failure.message).toBe(message);
    expect(failure.remediation).toBe(remediation);
  });

  it.each(PRODUCT_NAMES)("%s names the product on an exhausted 429", (productId, name) => {
    const failure = describeExhaustedRateLimit(productId);

    expect(failure.message).toBe(
      `${name} reported the account's balance or quota is exhausted (HTTP 429).`,
    );
    expect(failure.remediation).toBe("Check the account balance or plan, or change the model.");
  });
});
