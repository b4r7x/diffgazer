import {
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupClientTestHome, teardownClientTestHome } from "../../testing/ai-client-env.js";
import {
  CLIENT_TEST_CREDENTIAL_REFERENCE_IDENTITY,
  CLIENT_TEST_SECRET_LITERAL,
  CLIENT_TEST_WORKSPACE_ACCOUNT_REFERENCE,
  clientTestAdmittedPlan,
  clientTestAuthorize,
  clientTestBuildReceipt,
  clientTestCreateMockAdapter,
  clientTestExecutionResult,
} from "../../testing/ai-client-fixtures.js";
import { createFromAdmittedPlan } from "./create.js";
import { executeReviewGeneration } from "./generate.js";

const CONTRACT_TEST_LIMITS = Object.freeze({
  maxInputTokens: 32,
  maxOutputTokens: 8,
  maxResponseBytes: 1_024,
  wallTimeMs: 5_000,
  maxRetries: 1,
  maxConcurrency: 1,
  maxCostUsd: 0.05,
});

function admittedPlan(productId: Parameters<typeof clientTestAdmittedPlan>[0] = "gemini") {
  return clientTestAdmittedPlan(productId, { limits: CONTRACT_TEST_LIMITS });
}

describe("executeReviewGeneration contract", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("dispatches to the authorized adapter with the server-only credential resolver", async () => {
    const plan = admittedPlan("groq");
    const adapter = clientTestCreateMockAdapter("groq", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const executeSpy = vi.spyOn(adapter, "execute");
    const { authorization } = clientTestAuthorize(plan, adapter, { trackRelease: true });

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
    await expect(request?.resolveCredential?.()).resolves.toBe(CLIENT_TEST_SECRET_LITERAL);
  });

  it("binds immutable admitted limits to the execution receipt", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "completed", {
        usageAvailability: "reported",
        usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      }),
    );
    const { authorization } = clientTestAuthorize(plan, adapter);

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
    const adapter = clientTestCreateMockAdapter(
      "gemini",
      async () =>
        ({
          receipt: clientTestBuildReceipt(plan, "schema-failed"),
          result: { issues: [makeIssue()] },
        }) as ReturnType<typeof clientTestExecutionResult>,
    );
    const { authorization } = clientTestAuthorize(plan, adapter);

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
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = clientTestAuthorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: `Bearer ${CLIENT_TEST_SECRET_LITERAL} review`,
    });

    expect(JSON.stringify(result.diagnostic)).not.toContain(CLIENT_TEST_SECRET_LITERAL);
    expect(JSON.stringify(result.diagnostic)).not.toContain(
      CLIENT_TEST_CREDENTIAL_REFERENCE_IDENTITY,
    );
    expect(result.diagnostic.safeMessage).not.toContain(CLIENT_TEST_SECRET_LITERAL);
  });

  it("redacts workspace account references from diagnostics", async () => {
    const plan = admittedPlan("qwen");
    const adapter = clientTestCreateMockAdapter("qwen", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = clientTestAuthorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: `workspace=${CLIENT_TEST_WORKSPACE_ACCOUNT_REFERENCE}`,
    });

    expect(JSON.stringify(result.diagnostic)).not.toContain(
      CLIENT_TEST_WORKSPACE_ACCOUNT_REFERENCE,
    );
    if (result.diagnostic.truncatedDetails !== undefined) {
      expect(result.diagnostic.truncatedDetails).not.toContain(
        CLIENT_TEST_WORKSPACE_ACCOUNT_REFERENCE,
      );
    }
  });

  it("never persists raw home paths in diagnostics", async () => {
    const plan = admittedPlan("gemini");
    const adapter = clientTestCreateMockAdapter("gemini", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization } = clientTestAuthorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "review",
    });

    const serialized = JSON.stringify(result.diagnostic);
    expect(serialized).not.toMatch(/\/Users\//);
    expect(serialized).not.toContain(CLIENT_TEST_SECRET_LITERAL);
    expect(serialized).toContain(result.diagnostic.correlationId);
  });

  it("preserves provider-specific adapter behavior only through the admitted adapter route", async () => {
    const plan = admittedPlan("zai");
    const adapter = clientTestCreateMockAdapter("zai", async (request) => {
      expect(request.evidenceKey.productId).toBe("zai");
      return clientTestExecutionResult(plan, "schema-failed");
    });
    const { authorization } = clientTestAuthorize(plan, adapter);

    const result = await executeReviewGeneration({
      authorization,
      prompt: "review",
    });

    expect(result.execution.receipt.productId).toBe("zai");
    expect(result.execution.result.issues).toEqual([]);
  });

  it("keeps the review reservation open after a dispatch and leaves release to the owning session", async () => {
    const plan = admittedPlan("groq");
    const adapter = clientTestCreateMockAdapter("groq", async () =>
      clientTestExecutionResult(plan, "transport-failed"),
    );
    const { authorization, ledger, releaseTracker } = clientTestAuthorize(plan, adapter, {
      trackRelease: true,
    });

    await executeReviewGeneration({
      authorization,
      prompt: "review",
    });

    // The envelope belongs to the whole review, so later lenses can still spend
    // it; only the owning session's terminal release returns the remainder.
    expect(releaseTracker?.count).toBe(0);
    expect(ledger.snapshot().inFlightAttempts).toBe(1);

    authorization.release();

    expect(releaseTracker?.count).toBe(1);
    expect(ledger.snapshot().inFlightAttempts).toBe(0);
  });
});

describe("createFromAdmittedPlan generation surface", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

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
