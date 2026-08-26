import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  HOSTED_API_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  type ExecutionResult,
  ExecutionResultSchema,
  type ReviewIssue,
} from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { type AdapterExecuteRequest, assertBoundedExecutionResult } from "../types.js";
import { HOSTED_ADAPTERS } from "./hosted/transport.js";
import {
  ADAPTER_REGISTRY,
  FAIL_CLOSED_ADAPTER_OUTCOME,
  getAdapter,
  validateAdapterRegistry,
} from "./registry.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);

const limits = {
  maxInputTokens: 20_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const issue = {
  id: "issue-1",
  severity: "high",
  category: "correctness",
  title: "Incorrect branch",
  file: "src/app.ts",
  line_start: 10,
  line_end: 12,
  rationale: "The branch returns the wrong value.",
  recommendation: "Return the expected value.",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "The result is incorrect.",
  whyItMatters: "Callers receive invalid data.",
  evidence: [],
} satisfies ReviewIssue;

function suggestedModelId(productId: RunnableProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  if (productId === "openrouter") return "openai/gpt-4.1-mini";
  return "model-1";
}

function evidenceKeyFor(productId: RunnableProductId): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
  const modelId = suggestedModelId(productId);
  const noticeVersion = product.notice.noticeVersion;

  return {
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region: null,
    workspaceAccountReference: null,
    modelId,
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    noticeVersion,
    limits,
  };
}

function executeRequestFor(productId: RunnableProductId): AdapterExecuteRequest {
  return {
    configurationId: "configuration-1",
    configurationRevision: 3,
    evidenceKey: evidenceKeyFor(productId),
    prompt: "review prompt",
  };
}

describe("adapter registry", () => {
  it("enumerates exactly one wired adapter per runnable product id", () => {
    expect(Object.keys(ADAPTER_REGISTRY).sort()).toEqual([...RUNNABLE_PRODUCT_IDS].sort());
    expect(Object.keys(ADAPTER_REGISTRY)).toHaveLength(9);

    for (const productId of HOSTED_API_PRODUCT_IDS) {
      expect(ADAPTER_REGISTRY[productId]).toBe(HOSTED_ADAPTERS[productId]);
    }

    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const adapter = ADAPTER_REGISTRY[productId];
      expect(adapter.productId).toBe(productId);
      expect(adapter.transportFamily).toBe(PRODUCT_REGISTRY[productId].transportFamily);
    }

    expect(() => validateAdapterRegistry(ADAPTER_REGISTRY)).not.toThrow();
  });

  it.each([
    ...CANDIDATE_PRODUCT_IDS.slice(0, 3),
    "bogus-product",
    // Permanently removed products stay fail-closed instead of routing anywhere.
    "cerebras",
    "groq",
    "ollama",
    "local-openai",
    "codex-cli",
    "copilot-cli",
  ])("rejects candidate, removed, and unknown adapter registry keys (%s)", (productId) => {
    expect(() => getAdapter(productId)).toThrow(/Adapter unavailable/);
  });

  it("rejects forbidden registry keys at validation time", () => {
    expect(() =>
      validateAdapterRegistry({
        ...ADAPTER_REGISTRY,
        [CANDIDATE_PRODUCT_IDS[0]]: ADAPTER_REGISTRY.zai,
      }),
    ).toThrow(/Forbidden adapter registry key/);
  });

  it("rejects adapter route mismatch when registry key does not match adapter productId", () => {
    expect(() =>
      validateAdapterRegistry({
        ...ADAPTER_REGISTRY,
        zai: {
          ...ADAPTER_REGISTRY.gemini,
          productId: "gemini",
        },
      }),
    ).toThrow(/Adapter route mismatch/);
  });

  it("rejects a missing adapter for a runnable product", () => {
    const { zai: _zai, ...withoutZai } = ADAPTER_REGISTRY;
    expect(() => validateAdapterRegistry(withoutZai)).toThrow(
      /Missing adapter for runnable product: zai/,
    );
  });

  it("rejects adapter transport mismatch against the product registry", () => {
    expect(() =>
      validateAdapterRegistry({
        ...ADAPTER_REGISTRY,
        zai: {
          ...ADAPTER_REGISTRY.zai,
          transportFamily: "local-http",
        },
      }),
    ).toThrow(/Adapter transport mismatch for zai/);
  });

  it("returns bounded receipt and outcome without transport fallback", async () => {
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const adapter = getAdapter(productId);
      const result = await adapter.execute(executeRequestFor(productId));

      expect(result.receipt.outcome).toBe(FAIL_CLOSED_ADAPTER_OUTCOME);
      expect(result.receipt.productId).toBe(productId);
      expect(result.result.issues).toEqual([]);
      expect(ExecutionResultSchema.safeParse(result).success).toBe(true);
    }

    const mismatched = await ADAPTER_REGISTRY.gemini.execute({
      ...executeRequestFor("gemini"),
      evidenceKey: evidenceKeyFor("zai"),
    });
    expect(mismatched.receipt.outcome).toBe("transport-failed");
    expect(mismatched.result.issues).toEqual([]);
    expect(() => getAdapter("gemini")).not.toThrow();
    expect(() => getAdapter("zai")).not.toThrow();
  });

  it("keeps zero findings unless receipt outcome is completed", async () => {
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const result = await ADAPTER_REGISTRY[productId].execute(executeRequestFor(productId));
      expect(result.receipt.outcome).not.toBe("completed");
      expect(assertBoundedExecutionResult(result).result.issues).toEqual([]);
    }

    const failedReceipt = (
      await ADAPTER_REGISTRY.openrouter.execute(executeRequestFor("openrouter"))
    ).receipt;

    expect(
      ExecutionResultSchema.safeParse({
        receipt: failedReceipt,
        result: { issues: [] },
      }).success,
    ).toBe(true);
    expect(
      ExecutionResultSchema.safeParse({
        receipt: failedReceipt,
        result: { issues: [issue] },
      }).success,
    ).toBe(false);
    expect(() =>
      assertBoundedExecutionResult({
        receipt: failedReceipt,
        result: { issues: [issue] },
      } as ExecutionResult),
    ).toThrow(/cannot emit findings/);
  });

  it("does not alias candidate products into runnable adapters", () => {
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      expect(CANDIDATE_PRODUCT_IDS).not.toContain(productId);
    }
  });
});
