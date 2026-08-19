import {
  type ExecutionLimits,
  type ExecutionResult,
  ExecutionResultSchema,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { setupClientTestHome, teardownClientTestHome } from "../../testing/ai-client-env.js";
import {
  CLIENT_TEST_WORKSPACE_ACCOUNT_REFERENCE,
  clientTestAdmittedPlan,
  clientTestAuthorize,
  clientTestBuildReceipt,
  clientTestCreateMockAdapter,
  clientTestExecutionResult,
} from "../../testing/ai-client-fixtures.js";
import { STRUCTURED_OUTPUT_FAILURE_GUIDANCE } from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";
import { serializeFailureDiagnostic } from "../diagnostics.js";
import {
  estimatePromptTokens,
  estimateReviewInputTokens,
  promptAttemptEstimate,
} from "../providers/execution-receipt.js";
import { executeReviewGeneration } from "./generate.js";
import { toInitializedAIClient } from "./initialize.js";

const GENERATE_TEST_LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 40,
  maxOutputTokens: 8,
  maxResponseBytes: 512,
  wallTimeMs: 2_000,
  maxRetries: 1,
  maxConcurrency: 1,
  maxCostUsd: 0.01,
});

const OUTER_ADMISSION_PRODUCTS = ["gemini", "ollama", "codex-cli", "qwen"] as const;

const OUTER_ADMISSION_OVER_LIMIT_CASES = [
  {
    label: "system-only overflow",
    input: { prompt: "a".repeat(20), systemPrompt: "界".repeat(2) },
    limit: "user-only",
  },
  {
    label: "Unicode payload",
    input: { prompt: "界".repeat(10) },
    limit: "just-under-combined",
  },
] as const;

const OUTER_ADMISSION_OVER_LIMIT_MATRIX = OUTER_ADMISSION_PRODUCTS.flatMap((productId) =>
  OUTER_ADMISSION_OVER_LIMIT_CASES.map((inputCase) => ({ productId, ...inputCase })),
);

const QWEN_WORKSPACE_ADMISSION_CASES = [
  { label: "under", offset: 1, expectedOutcome: "completed", expectedDispatches: 1 },
  { label: "equal", offset: 0, expectedOutcome: "completed", expectedDispatches: 1 },
  { label: "over", offset: -1, expectedOutcome: "budget-exhausted", expectedDispatches: 0 },
] as const;

function admittedPlan(
  productId: Parameters<typeof clientTestAdmittedPlan>[0] = "gemini",
  limits: ExecutionLimits = GENERATE_TEST_LIMITS,
) {
  return clientTestAdmittedPlan(productId, { limits });
}

function authorize(
  plan: ReturnType<typeof admittedPlan>,
  adapter: ReturnType<typeof clientTestCreateMockAdapter>,
  ledger = createBudgetLedger(plan.limits),
) {
  return clientTestAuthorize(plan, adapter, {
    ledger,
    reservationPrompt: "review prompt",
    credential: "credential",
  });
}

describe("review generation hard limits", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("rejects prompts that exceed the admitted maxInputTokens limit before adapter dispatch", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () => {
      throw new Error("adapter must not run when input limit is exceeded");
    });
    const { authorization } = authorize(plan, adapter);

    const prompt = "x".repeat(plan.limits.maxInputTokens * 4 + 4);
    expect(estimatePromptTokens(prompt)).toBeGreaterThan(plan.limits.maxInputTokens);

    const result = await executeReviewGeneration({
      authorization,
      prompt,
    });

    expect(result.execution.receipt.outcome).toBe("budget-exhausted");
    expect(result.execution.result.issues).toEqual([]);
    expect(result.diagnostic.safeMessage).toContain("maxInputTokens");
  });

  it.each([
    {
      label: "CJK",
      prompt: "汉".repeat(50),
    },
    {
      label: "emoji",
      prompt: "🙂".repeat(50),
    },
    {
      label: "random code",
      prompt: "é".repeat(45),
    },
    {
      label: "XML entity expansion",
      prompt: "＜".repeat(45),
    },
  ])("rejects token-dense $label prompts the legacy /4 heuristic would admit", async ({
    prompt,
  }) => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () => {
      throw new Error("adapter must not run when input limit is exceeded");
    });
    const { authorization } = authorize(plan, adapter);

    expect(prompt.length / 4).toBeLessThanOrEqual(plan.limits.maxInputTokens);
    expect(estimatePromptTokens(prompt)).toBeGreaterThan(plan.limits.maxInputTokens);

    const result = await executeReviewGeneration({
      authorization,
      prompt,
    });

    expect(result.execution.receipt.outcome).toBe("budget-exhausted");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("admits mostly-ASCII prompts within the conservative bound", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);
    const prompt = "a".repeat((plan.limits.maxInputTokens - estimatePromptTokens("user")) * 4);

    expect(estimateReviewInputTokens({ prompt })).toBeLessThanOrEqual(plan.limits.maxInputTokens);

    const result = await executeReviewGeneration({
      authorization,
      prompt,
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
  });

  it.each(
    OUTER_ADMISSION_OVER_LIMIT_MATRIX,
  )("rejects $label before dispatch for $productId", async ({ productId, input, limit }) => {
    const userOnlyEstimate = estimateReviewInputTokens({ prompt: input.prompt });
    const combinedEstimate = estimateReviewInputTokens(input);
    const maxInputTokens = limit === "user-only" ? userOnlyEstimate : combinedEstimate - 1;
    const plan = admittedPlan(productId, {
      ...GENERATE_TEST_LIMITS,
      maxInputTokens,
    });
    let dispatchCount = 0;
    const adapter = clientTestCreateMockAdapter(productId, async () => {
      dispatchCount += 1;
      return clientTestExecutionResult(plan, "completed");
    });
    const { authorization } = authorize(plan, adapter);

    expect(combinedEstimate).toBeGreaterThan(maxInputTokens);
    if (limit === "user-only") {
      expect(userOnlyEstimate).toBeLessThanOrEqual(maxInputTokens);
    }

    const result = await executeReviewGeneration({
      authorization,
      ...input,
    });

    expect(dispatchCount).toBe(0);
    expect(result.execution.receipt.outcome).toBe("budget-exhausted");
    expect(result.execution.receipt.attemptCount).toBe(0);
    expect(result.execution.result.issues).toEqual([]);
  });

  it.each(
    OUTER_ADMISSION_PRODUCTS,
  )("dispatches once at the exact combined input boundary for %s", async (productId) => {
    const input = { prompt: "a".repeat(20), systemPrompt: "s".repeat(8) };
    const maxInputTokens = estimateReviewInputTokens(input);
    const plan = admittedPlan(productId, {
      ...GENERATE_TEST_LIMITS,
      maxInputTokens,
    });
    let dispatchCount = 0;
    let dispatchedSystemPrompt: string | undefined;
    const adapter = clientTestCreateMockAdapter(productId, async (request) => {
      dispatchCount += 1;
      dispatchedSystemPrompt = request.systemPrompt;
      return clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 7, outputTokens: 2, totalTokens: 9 },
      });
    });
    const { authorization, ledger } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      ...input,
    });

    expect(dispatchCount).toBe(1);
    expect(dispatchedSystemPrompt).toBe(input.systemPrompt);
    expect(result.execution.receipt.outcome).toBe("completed");
    expect(result.execution.receipt.attemptCount).toBe(1);
    expect(ledger.snapshot().committed.inputTokens).toBe(7);
    expect(ledger.snapshot().committed.outputTokens).toBe(2);
  });

  it.each(
    OUTER_ADMISSION_PRODUCTS,
  )("dispatches an empty system prompt as absent at the user-only boundary for %s", async (productId) => {
    const input = { prompt: "a".repeat(20), systemPrompt: "" };
    const userOnlyEstimate = estimateReviewInputTokens({ prompt: input.prompt });
    const plan = admittedPlan(productId, {
      ...GENERATE_TEST_LIMITS,
      maxInputTokens: userOnlyEstimate,
    });
    let dispatchCount = 0;
    let dispatchedSystemPrompt: string | undefined = "not-set";
    const adapter = clientTestCreateMockAdapter(productId, async (request) => {
      dispatchCount += 1;
      dispatchedSystemPrompt = request.systemPrompt;
      return clientTestExecutionResult(plan, "transport-failed");
    });
    const { authorization } = authorize(plan, adapter);

    expect(estimateReviewInputTokens(input)).toBe(userOnlyEstimate);

    const result = await executeReviewGeneration({
      authorization,
      ...input,
    });

    expect(dispatchCount).toBe(1);
    expect(dispatchedSystemPrompt).toBeUndefined();
    expect(result.execution.receipt.outcome).toBe("transport-failed");
  });

  it.each(
    QWEN_WORKSPACE_ADMISSION_CASES,
  )("keeps the Qwen workspace receipt valid when input is $label the admitted boundary", async ({
    offset,
    expectedOutcome,
    expectedDispatches,
  }) => {
    const input = { prompt: "a".repeat(20) };
    const inputEstimate = estimateReviewInputTokens(input);
    const plan = admittedPlan("qwen", {
      ...GENERATE_TEST_LIMITS,
      maxInputTokens: inputEstimate + offset,
    });
    let dispatchCount = 0;
    const adapter = clientTestCreateMockAdapter("qwen", async () => {
      dispatchCount += 1;
      return clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
    });
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      ...input,
    });

    expect(dispatchCount).toBe(expectedDispatches);
    expect(result.execution.receipt.outcome).toBe(expectedOutcome);
    expect(result.execution.receipt.workspaceAccountReference).toBe(
      CLIENT_TEST_WORKSPACE_ACCOUNT_REFERENCE,
    );
    expect(ExecutionResultSchema.safeParse(result.execution).success).toBe(true);
    if (expectedOutcome === "budget-exhausted") {
      expect(result.execution.receipt.attemptCount).toBe(0);
      expect(result.execution.result.issues).toEqual([]);
    }
  });

  it("settles output-token usage against the admitted maxOutputTokens budget", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("completed");
    expect(ledger.snapshot().committed.outputTokens).toBe(6);
  });

  it("commits exact over-limit provider usage before returning budget exhaustion", async () => {
    const tightLimits = { ...GENERATE_TEST_LIMITS, maxCostUsd: 1 };
    const plan = admittedPlan("gemini", tightLimits);
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "budget-exhausted", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 9, totalTokens: 13 },
      }),
    );
    const ledger = createBudgetLedger(tightLimits);
    const { authorization, releaseTracker } = clientTestAuthorize(plan, adapter, {
      ledger,
      reservationPrompt: "review prompt",
      credential: "credential",
      trackRelease: true,
    });

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("budget-exhausted");
    expect(result.execution.receipt.usage).toMatchObject({ inputTokens: 4, outputTokens: 9 });
    expect(result.execution.result.issues).toEqual([]);
    expect(ledger.snapshot()).toMatchObject({
      committed: expect.objectContaining({ inputTokens: 4, outputTokens: 9 }),
      settledAttempts: 1,
      exhaustedLimit: "maxOutputTokens",
      inFlightAttempts: 1,
    });

    authorization.release();
    authorization.release();

    expect(releaseTracker?.count).toBe(1);
    expect(ledger.snapshot()).toMatchObject({
      reserved: {
        inputTokens: 0,
        outputTokens: 0,
        responseBytes: 0,
        wallTimeMs: 0,
        costUsd: 0,
      },
      inFlightAttempts: 0,
      settledAttempts: 1,
    });
  });

  it("never settles response bytes a receipt did not report", async () => {
    const tightLimits = { ...GENERATE_TEST_LIMITS, maxResponseBytes: 8 };
    const plan = admittedPlan("gemini", tightLimits);
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    );
    const ledger = createBudgetLedger(tightLimits);
    const { authorization } = authorize(plan, adapter, ledger);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("completed");
    expect(ledger.snapshot().committed.responseBytes).toBe(0);
  });

  it("returns budget-exhausted with zero findings when wallTimeMs would be exceeded on settlement", async () => {
    const tightLimits = { ...GENERATE_TEST_LIMITS, wallTimeMs: 100 };
    const plan = admittedPlan("gemini", tightLimits);
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed", {
        startedAt: "2026-07-31T10:00:00.000Z",
        finishedAt: "2026-07-31T10:01:00.000Z",
      }),
    );
    const ledger = createBudgetLedger(tightLimits);
    const { authorization } = authorize(plan, adapter, ledger);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("budget-exhausted");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("charges every retry against maxRetries through the budget ledger", async () => {
    const plan = admittedPlan("gemini", {
      ...GENERATE_TEST_LIMITS,
      maxRetries: 0,
      maxConcurrency: 2,
    });
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const ledger = createBudgetLedger(plan.limits);
    const first = authorize(plan, adapter, ledger);
    await executeReviewGeneration({
      authorization: first.authorization,
      prompt: "short",
    });
    expect(ledger.snapshot().settledAttempts).toBe(1);

    const blocked = ledger.reserveAttempt(promptAttemptEstimate({ prompt: "short" }, plan.limits));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok && blocked.error.outcome === "budget-exhausted") {
      expect(blocked.error.limit).toBe("maxRetries");
    }
  });

  it("does not over-reserve concurrency beyond maxConcurrency", async () => {
    const plan = admittedPlan("gemini", {
      ...GENERATE_TEST_LIMITS,
      maxConcurrency: 1,
      maxRetries: 5,
    });
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const ledger = createBudgetLedger(plan.limits);
    const first = authorize(plan, adapter, ledger);
    const secondReserve = ledger.reserveAttempt(
      promptAttemptEstimate({ prompt: "short" }, plan.limits),
    );
    expect(secondReserve.ok).toBe(false);
    if (!secondReserve.ok && secondReserve.error.outcome === "budget-exhausted") {
      expect(secondReserve.error.limit).toBe("maxConcurrency");
    }

    await executeReviewGeneration({
      authorization: first.authorization,
      prompt: "short",
    });
    expect(ledger.snapshot().inFlightAttempts).toBe(1);

    first.authorization.release();
    expect(ledger.snapshot().inFlightAttempts).toBe(0);
  });

  it("settles the dollars reported tokens bill at the admitted model's pinned price", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 40, outputTokens: 8, totalTokens: 48 },
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("completed");
    expect(ledger.snapshot().committed.costUsd).toBeGreaterThan(0);
  });

  it("exhausts a spend cap the reported tokens would bill past", async () => {
    const plan = admittedPlan("gemini", { ...GENERATE_TEST_LIMITS, maxCostUsd: 0 });
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("budget-exhausted");
    expect(result.diagnostic.safeMessage).toContain("maxCostUsd");
  });

  it("settles no cost for a model the bundled catalog does not price", async () => {
    const plan = admittedPlan("ollama", { ...GENERATE_TEST_LIMITS, maxCostUsd: 0 });
    const adapter = clientTestCreateMockAdapter("ollama", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("completed");
    expect(ledger.snapshot().committed.costUsd).toBe(0);
  });
});

describe("review budget across lenses", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("aggregates usage from every sequential lens dispatch onto one review reservation", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const first = await executeReviewGeneration({ authorization, prompt: "short" });
    const second = await executeReviewGeneration({ authorization, prompt: "short" });

    expect(first.execution.receipt.outcome).toBe("completed");
    expect(second.execution.receipt.outcome).toBe("completed");
    expect(ledger.snapshot().committed.inputTokens).toBe(8);
    expect(ledger.snapshot().committed.outputTokens).toBe(6);
  });

  it("aggregates usage from parallel lens dispatches onto one review reservation", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const results = await Promise.all([
      executeReviewGeneration({ authorization, prompt: "short" }),
      executeReviewGeneration({ authorization, prompt: "short" }),
    ]);

    for (const result of results) {
      expect(result.execution.receipt.outcome).toBe("completed");
    }
    expect(ledger.snapshot().committed.outputTokens).toBe(6);
  });

  it("keeps metering later lenses after one adapter throw", async () => {
    const plan = admittedPlan("gemini");
    let calls = 0;
    const adapter = clientTestCreateMockAdapter("gemini", async () => {
      calls += 1;
      if (calls === 1) throw new Error("adapter crashed mid-review");
      return clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
      });
    });
    const { authorization, ledger } = authorize(plan, adapter);

    const first = await executeReviewGeneration({ authorization, prompt: "short" });
    expect(first.execution.receipt.outcome).toBe("transport-failed");

    const second = await executeReviewGeneration({ authorization, prompt: "short" });
    expect(second.execution.receipt.outcome).toBe("completed");
    expect(ledger.snapshot().committed.outputTokens).toBe(6);
    expect(ledger.snapshot().inFlightAttempts).toBe(1);
  });

  it("maps arbitrary adapter throws to a fixed diagnostic on returned and client surfaces", async () => {
    const promptSentinel = "user-prompt-sentinel";
    const systemPromptSentinel = "system-prompt-sentinel";
    const credentialSentinel = "opaque-adapter-credential-sentinel";
    const causeSentinel = "adapter-cause-sentinel";
    const stackSentinel = "adapter-stack-sentinel";
    const pathSentinel = "/private/adapter/path-sentinel";
    const sentinels = [
      promptSentinel,
      systemPromptSentinel,
      credentialSentinel,
      causeSentinel,
      stackSentinel,
      pathSentinel,
    ];
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async (request) => {
      expect(request.prompt).toBe(promptSentinel);
      expect(request.systemPrompt).toBe(systemPromptSentinel);
      await expect(request.resolveCredential?.()).resolves.toBe(credentialSentinel);
      const thrown = new Error(
        `user=${promptSentinel} system=${systemPromptSentinel} credential=${credentialSentinel}`,
      );
      thrown.cause = new Error(causeSentinel);
      thrown.stack = `${thrown.stack}\n${stackSentinel}`;
      Object.assign(thrown, { path: pathSentinel });
      throw thrown;
    });

    const directAuthorization = clientTestAuthorize(plan, adapter, {
      reservationPrompt: promptSentinel,
      credential: credentialSentinel,
    });
    const direct = await executeReviewGeneration({
      authorization: directAuthorization.authorization,
      prompt: promptSentinel,
      systemPrompt: systemPromptSentinel,
    });

    expect(direct.execution.receipt.outcome).toBe("transport-failed");
    expect(direct.execution.receipt.attemptCount).toBe(1);
    expect(direct.execution.result.issues).toEqual([]);
    expect(ExecutionResultSchema.safeParse(direct.execution).success).toBe(true);
    expect(direct.diagnostic).toMatchObject({
      code: "transport-failed",
      safeMessage: "Adapter execution failed.",
    });
    const directSurface = JSON.stringify(direct);
    for (const sentinel of sentinels) {
      expect(directSurface).not.toContain(sentinel);
    }

    const clientAuthorization = clientTestAuthorize(plan, adapter, {
      reservationPrompt: promptSentinel,
      credential: credentialSentinel,
    });
    const client = toInitializedAIClient(clientAuthorization.authorization);
    const clientResult = await client.generate(
      promptSentinel,
      z.object({ issues: z.array(z.unknown()) }),
      { systemPrompt: systemPromptSentinel },
    );

    expect(clientResult.ok).toBe(false);
    if (clientResult.ok) return;
    expect(clientResult.error).toMatchObject({
      code: "STREAM_ERROR",
      message: "Adapter execution failed.",
      diagnostic: {
        code: "transport-failed",
        safeMessage: "Adapter execution failed.",
      },
    });
    expect(client.terminalExecutions).toHaveLength(1);
    expect(client.terminalDiagnostics).toEqual([clientResult.error.diagnostic]);
    const clientSurface = JSON.stringify({
      error: clientResult.error,
      terminalExecutions: client.terminalExecutions,
      terminalDiagnostics: client.terminalDiagnostics,
    });
    for (const sentinel of sentinels) {
      expect(clientSurface).not.toContain(sentinel);
    }
  });

  it("preserves the fixed typed adapter failure diagnostic", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.diagnostic).toMatchObject({
      code: "transport-failed",
      safeMessage: "Adapter transport failed.",
    });
  });

  it("exhausts the review when cumulative lens usage passes an admitted dimension", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const first = await executeReviewGeneration({ authorization, prompt: "short" });
    expect(first.execution.receipt.outcome).toBe("completed");

    // 6 + 6 output tokens passes the admitted maxOutputTokens of 8.
    const second = await executeReviewGeneration({ authorization, prompt: "short" });
    expect(second.execution.receipt.outcome).toBe("budget-exhausted");
    expect(second.execution.result.issues).toEqual([]);
    expect(second.diagnostic.safeMessage).toContain("maxOutputTokens");
    expect(ledger.snapshot()).toMatchObject({
      committed: expect.objectContaining({ outputTokens: 12 }),
      settledAttempts: 2,
      exhaustedLimit: "maxOutputTokens",
    });
  });
});

describe("review generation usage rules", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("preserves reported usage on completed adapter receipts", async () => {
    const plan = admittedPlan("groq");
    const adapter = clientTestCreateMockAdapter("groq", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, cachedTokens: 2 },
      }),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.usageAvailability).toBe("reported");
    expect(result.execution.receipt.usage).toEqual({
      inputTokens: 12,
      outputTokens: 4,
      totalTokens: 16,
      cachedTokens: 2,
    });
  });

  it("keeps required-missing usage as a transport failure with zero findings", async () => {
    const plan = admittedPlan("deepseek");
    const adapter = clientTestCreateMockAdapter("deepseek", async () =>
      clientTestExecutionResult(plan, "transport-failed", {
        usageAvailability: "required-missing",
      }),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.usageAvailability).toBe("required-missing");
    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("labels optional missing usage as unavailable without inventing billed token counts", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed", {
        usageAvailability: "unavailable",
      }),
    );
    const { authorization, ledger } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.usageAvailability).toBe("unavailable");
    expect(result.execution.receipt.usage).toBeUndefined();
    expect(ledger.snapshot().committed.inputTokens).toBe(0);
    expect(ledger.snapshot().committed.outputTokens).toBe(0);
  });
});

describe("review generation terminal failures", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("returns zero findings for schema-failed adapter output", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "schema-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("schema-failed");
    expect(result.execution.result.issues).toEqual([]);
    expect(result.diagnostic.code).toBe("schema-failed");
    expect(result.diagnostic.remediation).toBe(STRUCTURED_OUTPUT_FAILURE_GUIDANCE);
  });

  it("returns zero findings for provider refusal transport failures", async () => {
    const plan = admittedPlan("mistral");
    const adapter = clientTestCreateMockAdapter("mistral", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("reports the adapter's own reason for a refused request instead of the generic transport message", async () => {
    const plan = admittedPlan("mistral");
    const adapter = clientTestCreateMockAdapter("mistral", async (request) => {
      request.reportDiagnostic?.(
        serializeFailureDiagnostic({
          code: "provider-rejected",
          message: "Mistral rejected the credential (HTTP 401).",
          remediation: "Update the configuration with a valid API key.",
        }),
      );
      return clientTestExecutionResult(plan, "transport-failed");
    });
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.diagnostic).toMatchObject({
      code: "provider-rejected",
      safeMessage: "Mistral rejected the credential (HTTP 401).",
    });
  });

  it("returns zero findings for partial adapter output without prose salvage", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter(
      "gemini",
      async () =>
        ({
          receipt: clientTestBuildReceipt(plan, "schema-failed"),
          result: { issues: [makeIssue({ id: "partial" })] },
        }) as ExecutionResult,
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: 'prose wrapped {"issues":[]}',
    });

    expect(result.execution.result.issues).toEqual([]);
    expect(result.execution.receipt.outcome).not.toBe("completed");
  });

  it("returns cancelled with zero findings when the abort signal is already set", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () => {
      throw new Error("adapter must not run when already aborted");
    });
    const { authorization } = authorize(plan, adapter);
    const controller = new AbortController();
    controller.abort();

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
      signal: controller.signal,
    });

    expect(result.execution.receipt.outcome).toBe("cancelled");
    expect(result.execution.result.issues).toEqual([]);
    expect(result.diagnostic.code).toBe("cancelled");
  });

  it("returns zero findings for redirect provider failures", async () => {
    const plan = admittedPlan("openrouter");
    const adapter = clientTestCreateMockAdapter("openrouter", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.execution.result.issues).toEqual([]);
    expect(ExecutionResultSchema.safeParse(result.execution).success).toBe(true);
  });

  it("returns zero findings for generic provider transport failures", async () => {
    const plan = admittedPlan("cerebras");
    const adapter = clientTestCreateMockAdapter("cerebras", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.execution.result.issues).toEqual([]);
  });
});

describe("review generation redaction", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("redacts bearer tokens from failure diagnostics", async () => {
    const plan = admittedPlan("gemini");
    const secret = "sk-test-bearer-token-value";
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: `Authorization: Bearer ${secret}`,
    });

    expect(JSON.stringify(result.diagnostic)).not.toContain(secret);
  });
});
