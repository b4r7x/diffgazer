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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdmittedExecutionPlan } from "../admission/service.js";
import { ExecutionLeaseRegistry } from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import { setupClientTestHome, teardownClientTestHome } from "./client-test-env.js";
import { createFromAdmittedPlan } from "./create.js";
import { executeReviewGeneration } from "./generate.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const INSTALLATION_ID = "codex-installation-1";
const SECRET_LITERAL = "sk-live-provider-secret-value";

const LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 32,
  maxOutputTokens: 8,
  maxResponseBytes: 1_024,
  wallTimeMs: 5_000,
  maxRetries: 1,
  maxConcurrency: 1,
  maxCostUsd: 0.05,
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

function admittedPlan(productId: RunnableProductId = "gemini"): AdmittedExecutionPlan {
  const evidenceKey = evidenceKeyFor(productId);
  return Object.freeze({
    configurationId: `${productId}-configuration`,
    configurationRevision: 1,
    executionFingerprint: `${productId}-fingerprint`,
    evidenceKey: Object.freeze({
      ...evidenceKey,
      runtime: Object.freeze({ ...evidenceKey.runtime }),
      limits: Object.freeze({ ...evidenceKey.limits }),
    }),
    productId,
    transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
    limits: Object.freeze({ ...LIMITS }),
  });
}

function buildReceipt(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  patch: Partial<ExecutionResult["receipt"]> = {},
): ExecutionResult["receipt"] {
  const startedAt = "2026-07-31T10:00:00.000Z";
  const finishedAt = "2026-07-31T10:00:01.000Z";
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
  const estimate = {
    inputTokens: plan.limits.maxInputTokens,
    outputTokens: plan.limits.maxOutputTokens,
    responseBytes: plan.limits.maxResponseBytes,
    wallTimeMs: plan.limits.wallTimeMs,
    costUsd: plan.limits.maxCostUsd,
  };
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
  const releaseTracker = { count: 0 };
  let released = false;
  return {
    authorization: Object.freeze({
      plan,
      adapter,
      budgetLedger: ledger,
      budgetReservation: budgetReservation.value,
      lease: lease.value,
      resolveCredential: async () => SECRET_LITERAL,
      workspaceAccountId: null,
      release: () => {
        if (released) return;
        released = true;
        releaseTracker.count += 1;
        ledger.releaseReservation(budgetReservation.value);
        lease.value.release();
      },
    }),
    ledger,
    releaseTracker,
  };
}

describe("executeReviewGeneration contract", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("dispatches to the authorized adapter with the server-only credential resolver", async () => {
    const plan = admittedPlan("groq");
    const adapter = createMockAdapter("groq", async () =>
      executionResult(plan, "transport-failed"),
    );
    const executeSpy = vi.spyOn(adapter, "execute");
    const { authorization } = authorize(plan, adapter);

    await executeReviewGeneration({
      authorization,
      prompt: "review prompt",
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationId: plan.configurationId,
        configurationRevision: plan.configurationRevision,
        evidenceKey: plan.evidenceKey,
        prompt: "review prompt",
      }),
    );
    const request = executeSpy.mock.calls[0]?.[0];
    await expect(request?.resolveCredential?.()).resolves.toBe(SECRET_LITERAL);
  });

  it("binds immutable admitted limits to the execution receipt", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      }),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short prompt",
    });

    expect(result.execution.receipt.limits).toEqual(plan.limits);
    expect(result.execution.receipt.productId).toBe(plan.productId);
    expect(result.execution.receipt.modelId).toBe(plan.evidenceKey.modelId);
    expect(result.execution.receipt.executionFingerprint).toBe(
      hashExecutionReceiptFingerprintSync({
        configurationId: plan.configurationId,
        configurationRevision: plan.configurationRevision,
        authentication: plan.evidenceKey.authentication,
        credentialReferenceIdentity: plan.evidenceKey.credentialReferenceIdentity,
        installationId: plan.evidenceKey.installationId,
        productId: plan.productId,
        transportFamily: plan.transportFamily,
        modelId: plan.evidenceKey.modelId,
        normalizedEndpoint: plan.evidenceKey.normalizedEndpoint,
        region: plan.evidenceKey.region,
        workspaceAccountReference: plan.evidenceKey.workspaceAccountReference,
        runtime: plan.evidenceKey.runtime,
        structuredOutputSchemaSha256: plan.evidenceKey.structuredOutputSchemaSha256,
        noticeVersion: plan.evidenceKey.noticeVersion,
        limits: plan.limits,
      }),
    );
  });

  it("rejects an adapter result that carries findings on a failed receipt", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter(
      "gemini",
      async () =>
        ({
          receipt: buildReceipt(plan, "schema-failed"),
          result: { issues: [makeIssue()] },
        }) as ExecutionResult,
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "short prompt",
    });

    expect(result.execution.receipt.outcome).toBe("transport-failed");
    expect(result.execution.result.issues).toEqual([]);
    expect(ExecutionResultSchema.safeParse(result.execution).success).toBe(true);
  });

  it("redacts configured credential references from failure diagnostics", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: `Bearer ${SECRET_LITERAL} review`,
    });

    expect(JSON.stringify(result.diagnostic)).not.toContain(SECRET_LITERAL);
    expect(JSON.stringify(result.diagnostic)).not.toContain(CREDENTIAL_REFERENCE_IDENTITY);
    expect(result.diagnostic.safeMessage).not.toContain(SECRET_LITERAL);
  });

  it("redacts workspace account references from diagnostics", async () => {
    const plan = admittedPlan("qwen");
    const adapter = createMockAdapter("qwen", async () =>
      executionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: `workspace=${WORKSPACE_ACCOUNT_REFERENCE}`,
    });

    expect(JSON.stringify(result.diagnostic)).not.toContain(WORKSPACE_ACCOUNT_REFERENCE);
    if (result.diagnostic.truncatedDetails !== undefined) {
      expect(result.diagnostic.truncatedDetails).not.toContain(WORKSPACE_ACCOUNT_REFERENCE);
    }
  });

  it("never persists raw home paths in diagnostics", async () => {
    const plan = admittedPlan("gemini");
    const adapter = createMockAdapter("gemini", async () =>
      executionResult(plan, "transport-failed"),
    );
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "review",
    });

    const serialized = JSON.stringify(result.diagnostic);
    expect(serialized).not.toMatch(/\/Users\//);
    expect(serialized).not.toContain(SECRET_LITERAL);
    expect(serialized).toContain(result.diagnostic.correlationId);
  });

  it("preserves provider-specific adapter behavior only through the admitted adapter route", async () => {
    const plan = admittedPlan("zai");
    const adapter = createMockAdapter("zai", async (request) => {
      expect(request.evidenceKey.productId).toBe("zai");
      return executionResult(plan, "schema-failed");
    });
    const { authorization } = authorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "review",
    });

    expect(result.execution.receipt.productId).toBe("zai");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("settles the reservation and leaves lease release to the owning review session", async () => {
    const plan = admittedPlan("groq");
    const adapter = createMockAdapter("groq", async () =>
      executionResult(plan, "transport-failed"),
    );
    const { authorization, ledger, releaseTracker } = authorize(plan, adapter);

    await executeReviewGeneration({
      authorization,
      prompt: "review",
    });

    expect(releaseTracker.count).toBe(0);
    expect(ledger.snapshot().inFlightAttempts).toBe(0);
  });
});

describe("createFromAdmittedPlan generation surface", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("does not expose legacy createAIClient generation helpers", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./generate.ts", import.meta.url), "utf8"),
    );
    expect(source).not.toMatch(/extractJsonObject/);
    expect(source).not.toMatch(/salvag/i);
    expect(source).not.toMatch(/from "ai"/);
    expect(source).not.toMatch(/createLanguageModel/);
  });

  it("creates an admitted-plan client that delegates to the registry adapter", async () => {
    const plan = admittedPlan("cerebras");
    const clientResult = createFromAdmittedPlan(plan);
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute("review prompt");
    expect(execution.receipt.productId).toBe("cerebras");
    expect(execution.result.issues).toEqual([]);
  });
});
