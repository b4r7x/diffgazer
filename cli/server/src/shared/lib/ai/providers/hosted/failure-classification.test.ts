import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import {
  describeExhaustedRateLimit,
  describeHttpFailure,
  readOpenAiErrorEnvelope,
} from "./failure-classification.js";

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
    ["commandcode", "Command Code"],
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

describe("body-aware copy", () => {
  const P5_403_PLAN = {
    error: {
      message:
        "MODEL_NOT_IN_PLAN: GPT-5.5 available in Pro and above plans or extra on demand usage",
      type: "permission_error",
      code: "FORBIDDEN",
    },
  };
  const GO_PLAN_403 = {
    error: {
      message:
        "Your Go plan doesn't include API access. Upgrade to Provider or higher at https://commandcode.ai/billing to use these endpoints.",
      type: "permission_error",
      code: "upgrade_required",
    },
  };
  const P6_400_CLAUDE = {
    error: {
      message:
        'Model "claude-sonnet-4-6" must be called via /provider/v1/messages (Anthropic Messages shape).',
      type: "invalid_request_error",
      param: "model",
      code: "unsupported_model",
    },
  };
  const P7_400_UNKNOWN = {
    error: {
      message: 'Model "does-not-exist/foo" is not supported on this endpoint.',
      type: "invalid_request_error",
      param: "model",
      code: "unsupported_model",
    },
  };
  const P10A_400_PARAM = {
    error: {
      message: 'Invalid option: expected one of "low"|"medium"|"high"|"xhigh"|"max"',
      type: "invalid_request_error",
      param: "reasoning_effort",
    },
  };
  const P12_401 = {
    error: {
      message: "Invalid 'Authorization' header or token.",
      type: "authentication_error",
      code: "UNAUTHORIZED",
    },
  };
  const ALT_401 = {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      status: 401,
      message: "Invalid 'Authorization' header or token.",
      docs: "https://commandcode.ai/docs/reference/errors/unauthorized",
    },
  };
  const P3_422_ZDR = {
    error: {
      message:
        "This model has no zero-data-retention upstream. Remove the x-cmd-zdr header or choose a different model.",
      type: "invalid_request_error",
      code: "cmd_zdr_no_providers",
    },
  };

  it("names the plan on a 403 FORBIDDEN / MODEL_NOT_IN_PLAN body", () => {
    const failure = describeHttpFailure(
      "commandcode",
      403,
      undefined,
      readOpenAiErrorEnvelope(JSON.stringify(P5_403_PLAN)),
    );

    expect(failure.code).toBe("provider-rejected");
    expect(failure.retryable).toBe(false);
    expect(failure.message).toBe(
      "Command Code reported the selected model is not included in the account's plan (HTTP 403).",
    );
    expect(failure.remediation).toBe(
      "Select a different model, upgrade the plan, or add pay-as-you-go credits for this model.",
    );
  });

  it("keeps the hedged 403 copy for the Go-plan upgrade_required body", () => {
    const failure = describeHttpFailure(
      "commandcode",
      403,
      undefined,
      readOpenAiErrorEnvelope(JSON.stringify(GO_PLAN_403)),
    );

    expect(failure.message).toBe("Command Code refused access (HTTP 403).");
    expect(failure.remediation).toBe(
      "Check the API key and the account's access to the selected model.",
    );
  });

  it("keeps the hedged 403 copy when only the code matches", () => {
    const failure = describeHttpFailure(
      "commandcode",
      403,
      undefined,
      readOpenAiErrorEnvelope(JSON.stringify({ error: { code: "FORBIDDEN", message: "denied" } })),
    );

    expect(failure.message).toBe("Command Code refused access (HTTP 403).");
    expect(failure.remediation).toBe(
      "Check the API key and the account's access to the selected model.",
    );
  });

  it.each([
    P6_400_CLAUDE,
    P7_400_UNKNOWN,
  ])("names the endpoint on a 400 unsupported_model body", (fixture) => {
    const failure = describeHttpFailure(
      "commandcode",
      400,
      undefined,
      readOpenAiErrorEnvelope(JSON.stringify(fixture)),
    );

    expect(failure.message).toBe(
      "Command Code does not serve the selected model on this endpoint (HTTP 400).",
    );
    expect(failure.remediation).toBe("Select a different model.");
  });

  it("keeps the context-window copy for a 400 without a code", () => {
    const failure = describeHttpFailure(
      "commandcode",
      400,
      undefined,
      readOpenAiErrorEnvelope(JSON.stringify(P10A_400_PARAM)),
    );

    expect(failure.message).toBe("Command Code rejected the request as invalid (HTTP 400).");
    expect(failure.remediation).toBe(
      "Often the diff is too large for the model's context window. Reduce the review scope, or choose a model with a larger context.",
    );
  });

  it.each([
    JSON.stringify(P12_401),
    JSON.stringify(ALT_401),
    "<html>gateway</html>",
    "",
  ])("reports the credential rejection for both 401 envelopes and a non-JSON body", (text) => {
    const failure = describeHttpFailure(
      "commandcode",
      401,
      undefined,
      readOpenAiErrorEnvelope(text),
    );

    expect(failure.message).toBe("Command Code rejected the credential (HTTP 401).");
    expect(failure.remediation).toBe("Update the configuration with a valid API key.");
  });

  it("leaves 422 on the default copy", () => {
    const failure = describeHttpFailure(
      "commandcode",
      422,
      undefined,
      readOpenAiErrorEnvelope(JSON.stringify(P3_422_ZDR)),
    );

    expect(failure.message).toBe("Command Code returned HTTP 422.");
    expect(failure.retryable).toBe(false);
    expect(failure.remediation).toBeUndefined();
  });
});
