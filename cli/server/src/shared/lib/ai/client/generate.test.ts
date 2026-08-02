import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  type ExecutionLimits,
  type ExecutionResult,
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdmittedExecutionPlan } from "../admission/service.js";
import { ExecutionLeaseRegistry } from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import { setupClientTestHome, teardownClientTestHome } from "./client-test-env.js";
import {
  conservativeAttemptEstimate,
  estimatePromptTokens,
  executeReviewGeneration,
} from "./generate.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const INSTALLATION_ID = "codex-installation-1";

const LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 40,
  maxOutputTokens: 8,
  maxResponseBytes: 512,
  wallTimeMs: 2_000,
  maxRetries: 1,
  maxConcurrency: 1,
  maxCostUsd: 0.01,
});

function suggestedModelId(productId: RunnableProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  if (productId === "openrouter") return "openai/gpt-4.1-mini";
  if (productId === "moonshot") return "kimi-k3-2026-01";
  if (productId === "ollama") return "llama3.2";
  if (productId === "codex-cli") return "gpt-5-codex";
  if (productId === "copilot-cli") return "gpt-5";
  return "model-1";
}

function evidenceKeyFor(productId: RunnableProductId): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
  const modelId = suggestedModelId(productId);
  const noticeVersion = product.notice.noticeVersion;

  switch (product.transportFamily) {
    case "hosted-api": {
      const region = endpoint && "region" in endpoint ? (endpoint.region ?? null) : null;
      return {
        authentication: null,
        credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
        installationId: null,
        productId,
        transportFamily: "hosted-api",
        normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
        region,
        workspaceAccountReference:
          endpoint && "workspaceBound" in endpoint && endpoint.workspaceBound
            ? WORKSPACE_ACCOUNT_REFERENCE
            : null,
        modelId,
        runtime: { identity: "diffgazer-server", version: "1.2.3" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
        noticeVersion,
        limits: LIMITS,
      };
    }
    case "local-http":
      return {
        authentication: "none",
        credentialReferenceIdentity: null,
        installationId: null,
        productId,
        transportFamily: "local-http",
        normalizedEndpoint:
          productId === "local-openai"
            ? LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"]
            : (endpoint?.endpoint ?? "http://127.0.0.1:11434"),
        region: null,
        workspaceAccountReference: null,
        modelId,
        runtime:
          productId === "local-openai"
            ? { identity: "llama-cpp", version: "b-version-2026-07" }
            : { identity: "ollama", version: "0.6.0" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
        noticeVersion,
        limits: LIMITS,
      };
    case "local-cli":
      return {
        authentication: null,
        credentialReferenceIdentity: null,
        installationId: productId === "codex-cli" ? INSTALLATION_ID : "copilot-installation",
        productId,
        transportFamily: "local-cli",
        normalizedEndpoint: null,
        region: null,
        workspaceAccountReference: null,
        modelId,
        runtime: { identity: productId, version: "0.1.0" },
        structuredOutputSchemaSha256: SCHEMA_SHA256,
        noticeVersion,
        limits: LIMITS,
      };
  }
}

function admittedPlan(
  productId: RunnableProductId = "gemini",
  limits: ExecutionLimits = LIMITS,
): AdmittedExecutionPlan {
  const evidenceKey = evidenceKeyFor(productId);
  return Object.freeze({
    configurationId: `${productId}-configuration`,
    configurationRevision: 1,
    executionFingerprint: `${productId}-fingerprint`,
    evidenceKey: Object.freeze({
      ...evidenceKey,
      runtime: Object.freeze({ ...evidenceKey.runtime }),
      limits: Object.freeze({ ...limits }),
    }),
    productId,
    transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
    limits: Object.freeze({ ...limits }),
  });
}

function buildReceipt(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  patch: Partial<ExecutionResult["receipt"]> = {},
): ExecutionResult["receipt"] {
  const startedAt = patch.startedAt ?? "2026-07-31T10:00:00.000Z";
  const finishedAt = patch.finishedAt ?? "2026-07-31T10:00:01.000Z";
  const { evidenceKey } = plan;
  const executionFingerprint = hashExecutionReceiptFingerprintSync({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    authentication: evidenceKey.authentication,
    credentialReferenceIdentity: evidenceKey.credentialReferenceIdentity,
    installationId: evidenceKey.installationId,
    productId: evidenceKey.productId,
    transportFamily: evidenceKey.transportFamily,
    modelId: evidenceKey.modelId,
    normalizedEndpoint: evidenceKey.normalizedEndpoint,
    region: evidenceKey.region,
    workspaceAccountReference: evidenceKey.workspaceAccountReference,
    runtime: evidenceKey.runtime,
    structuredOutputSchemaSha256: evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: evidenceKey.noticeVersion,
    limits: plan.limits,
  });
  return {
    schemaVersion: 1,
    executionFingerprint,
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    authentication: plan.evidenceKey.authentication,
    credentialReferenceIdentity: plan.evidenceKey.credentialReferenceIdentity,
    installationId: plan.evidenceKey.installationId,
    productId: plan.productId,
    transportFamily: plan.transportFamily,
    modelId: plan.evidenceKey.modelId,
    normalizedEndpoint: plan.evidenceKey.normalizedEndpoint,
    region: plan.evidenceKey.region ?? undefined,
    workspace: plan.evidenceKey.workspaceAccountReference ?? undefined,
    runtime: plan.evidenceKey.runtime,
    structuredOutputSchemaSha256: plan.evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: plan.evidenceKey.noticeVersion,
    limits: plan.limits,
    attemptCount: 1,
    startedAt,
    finishedAt,
    usageAvailability: "unavailable",
    outcome,
    ...patch,
  } as ExecutionResult["receipt"];
}

function executionResult(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  patch: Partial<ExecutionResult["receipt"]> = {},
  issues: ExecutionResult["result"]["issues"] = [],
): ExecutionResult {
  return ExecutionResultSchema.parse({
    receipt: buildReceipt(plan, outcome, patch),
    result: { issues },
  });
}

function createMockAdapter(
  productId: RunnableProductId,
  execute: (request: AdapterExecuteRequest) => Promise<ExecutionResult>,
): Adapter {
  return {
    productId,
    transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
    execute,
  };
}

function authorize(
  plan: AdmittedExecutionPlan,
  adapter: Adapter,
  ledger = createBudgetLedger(plan.limits),
) {
  const estimate = conservativeAttemptEstimate("review prompt", plan.limits);
  const budgetReservation = ledger.reserveAttempt(estimate);
  if (!budgetReservation.ok) {
    throw new Error("budget reservation failed in test setup");
  }
  const leaseRegistry = new ExecutionLeaseRegistry();
  const lease = leaseRegistry.tryAcquire({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    executionFingerprint: plan.executionFingerprint,
    limits: plan.limits,
  });
  if (!lease.ok) {
    throw new Error("lease acquisition failed in test setup");
  }
  let released = false;
  return {
    authorization: Object.freeze({
      plan,
      adapter,
      budgetLedger: ledger,
      budgetReservation: budgetReservation.value,
      lease: lease.value,
      resolveCredential: async () => "credential",
      workspaceAccountId: null,
      release: () => {
        if (released) return;
        released = true;
        ledger.releaseReservation(budgetReservation.value);
        lease.value.release();
      },
    }),
    ledger,
  };
}

describe("review generation hard limits", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("rejects prompts that exceed the admitted maxInputTokens limit before adapter dispatch", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter("gemini", async () => {
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

  it("settles output-token usage against the admitted maxOutputTokens budget", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "completed", {
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

  it("never settles response bytes a receipt did not report", async () => {
    const tightLimits = { ...LIMITS, maxResponseBytes: 8 };
    const plan = admittedPlan("gemini", tightLimits);
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "completed", {
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
    const tightLimits = { ...LIMITS, wallTimeMs: 100 };
    const plan = admittedPlan("gemini", tightLimits);
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed", {
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
    const plan = admittedPlan("gemini", { ...LIMITS, maxRetries: 0, maxConcurrency: 2 });
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed"),
    );
    const ledger = createBudgetLedger(plan.limits);
    const first = authorize(plan, adapter, ledger);
    await executeReviewGeneration({
      authorization: first.authorization,
      prompt: "short",
    });
    expect(ledger.snapshot().settledAttempts).toBe(1);

    const blocked = ledger.reserveAttempt(conservativeAttemptEstimate("short", plan.limits));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok && blocked.error.outcome === "budget-exhausted") {
      expect(blocked.error.limit).toBe("maxRetries");
    }
  });

  it("does not over-reserve concurrency beyond maxConcurrency", async () => {
    const plan = admittedPlan("gemini", { ...LIMITS, maxConcurrency: 1, maxRetries: 5 });
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed"),
    );
    const ledger = createBudgetLedger(plan.limits);
    const first = authorize(plan, adapter, ledger);
    const secondReserve = ledger.reserveAttempt(conservativeAttemptEstimate("short", plan.limits));
    expect(secondReserve.ok).toBe(false);
    if (!secondReserve.ok && secondReserve.error.outcome === "budget-exhausted") {
      expect(secondReserve.error.limit).toBe("maxConcurrency");
    }

    await executeReviewGeneration({
      authorization: first.authorization,
      prompt: "short",
    });
    expect(ledger.snapshot().inFlightAttempts).toBe(0);
  });

  it("never settles a cost the provider did not bill", async () => {
    const plan = admittedPlan("gemini", { ...LIMITS, maxCostUsd: 0 });
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "completed", {
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

describe("review generation usage rules", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("preserves reported usage on completed adapter receipts", async () => {
    const plan = admittedPlan("groq");
    const adapter = createMockAdapter("groq", async () =>
      executionResult(plan, "completed", {
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
    const adapter = createMockAdapter("deepseek", async () =>
      executionResult(plan, "transport-failed", {
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
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed", {
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
    const adapter = createMockAdapter("gemini", async () => executionResult(plan, "schema-failed"));
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("schema-failed");
    expect(result.execution.result.issues).toEqual([]);
    expect(result.diagnostic.code).toBe("schema-failed");
  });

  it("returns zero findings for provider refusal transport failures", async () => {
    const plan = admittedPlan("mistral");
    const adapter = createMockAdapter("mistral", async () =>
      executionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("returns zero findings for partial adapter output without prose salvage", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter(
      "gemini",
      async () =>
        ({
          receipt: buildReceipt(plan, "schema-failed"),
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
    const adapter = createMockAdapter("gemini", async () => {
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
    const adapter = createMockAdapter("openrouter", async () =>
      executionResult(plan, "transport-failed"),
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
    const adapter = createMockAdapter("cerebras", async () =>
      executionResult(plan, "transport-failed"),
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
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: `Authorization: Bearer ${secret}`,
    });

    expect(JSON.stringify(result.diagnostic)).not.toContain(secret);
  });
});
