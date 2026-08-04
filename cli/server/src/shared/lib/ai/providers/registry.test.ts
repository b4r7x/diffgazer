import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  HOSTED_API_PRODUCT_IDS,
  LOCAL_HTTP_PRODUCT_IDS,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
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
import {
  type AdapterExecuteRequest,
  assertBoundedExecutionResult,
  getSafeAdapterIdentity,
  getSafeAdapterProductNotice,
} from "../types.js";
import { HOSTED_ADAPTERS } from "./hosted/transport.js";
import { localOpenaiAdapter, ollamaAdapter } from "./local-http/transport.js";
import {
  ADAPTER_REGISTRY,
  bundledCliCompatibilityRecordCount,
  CLI_ADAPTERS,
  FAIL_CLOSED_ADAPTER_OUTCOME,
  getAdapter,
  LOCAL_HTTP_ADAPTERS,
  listRunnableAdapterIdentities,
  listRunnableAdapterNotices,
  validateAdapterRegistry,
} from "./registry.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const INSTALLATION_ID = "codex-installation-1";

const limits = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
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
        limits,
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
        limits,
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
        limits,
      };
  }
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
    expect(Object.keys(ADAPTER_REGISTRY)).toHaveLength(13);

    for (const productId of HOSTED_API_PRODUCT_IDS) {
      expect(ADAPTER_REGISTRY[productId]).toBe(HOSTED_ADAPTERS[productId]);
    }

    expect(ADAPTER_REGISTRY.ollama).toBe(ollamaAdapter);
    expect(ADAPTER_REGISTRY.ollama).toBe(LOCAL_HTTP_ADAPTERS.ollama);
    expect(ADAPTER_REGISTRY["local-openai"]).toBe(localOpenaiAdapter);
    expect(ADAPTER_REGISTRY["local-openai"]).toBe(LOCAL_HTTP_ADAPTERS["local-openai"]);

    expect(ADAPTER_REGISTRY["codex-cli"]).toBe(CLI_ADAPTERS["codex-cli"]);
    expect(ADAPTER_REGISTRY["copilot-cli"]).toBe(CLI_ADAPTERS["copilot-cli"]);

    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const adapter = ADAPTER_REGISTRY[productId];
      expect(adapter.productId).toBe(productId);
      expect(adapter.transportFamily).toBe(PRODUCT_REGISTRY[productId].transportFamily);
    }

    expect(() => validateAdapterRegistry(ADAPTER_REGISTRY)).not.toThrow();
  });

  it("exposes safe adapter identity and product notices for every runnable product", () => {
    expect(listRunnableAdapterIdentities()).toHaveLength(13);
    expect(listRunnableAdapterNotices()).toHaveLength(13);

    for (const productId of RUNNABLE_PRODUCT_IDS) {
      const identity = getSafeAdapterIdentity(ADAPTER_REGISTRY[productId]);
      expect(identity).toEqual({
        productId,
        transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
      });
      expect(Object.keys(identity).sort()).toEqual(["productId", "transportFamily"]);

      const notice = getSafeAdapterProductNotice(productId);
      expect(notice.productId).toBe(productId);
      expect(notice.noticeId).toBe(PRODUCT_REGISTRY[productId].notice.id);
      expect(notice.noticeVersion).toBe(PRODUCT_REGISTRY[productId].notice.noticeVersion);
      expect(notice.privacy.length).toBeGreaterThan(0);
      expect(Object.keys(notice).sort()).toEqual([
        "billing",
        "noticeId",
        "noticeVersion",
        "privacy",
        "productId",
      ]);
      expect(JSON.stringify(notice)).not.toMatch(/"apiKey"|"credential"|"password"|"secret"/i);
    }
  });

  it.each([
    ...CANDIDATE_PRODUCT_IDS.slice(0, 3),
    "bogus-product",
  ])("rejects candidate and unknown adapter registry keys (%s)", (productId) => {
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
        groq: {
          ...ADAPTER_REGISTRY.gemini,
          productId: "gemini",
        },
      }),
    ).toThrow(/Adapter route mismatch/);
  });

  it("rejects a missing adapter for a runnable product", () => {
    const { groq: _groq, ...withoutGroq } = ADAPTER_REGISTRY;
    expect(() => validateAdapterRegistry(withoutGroq)).toThrow(
      /Missing adapter for runnable product: groq/,
    );
  });

  it("rejects adapter transport mismatch against the product registry", () => {
    expect(() =>
      validateAdapterRegistry({
        ...ADAPTER_REGISTRY,
        groq: {
          ...ADAPTER_REGISTRY.groq,
          transportFamily: "local-http",
        },
      }),
    ).toThrow(/Adapter transport mismatch for groq/);
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
      evidenceKey: evidenceKeyFor("groq"),
    });
    expect(mismatched.receipt.outcome).toBe("transport-failed");
    expect(mismatched.result.issues).toEqual([]);
    expect(() => getAdapter("gemini")).not.toThrow();
    expect(() => getAdapter("groq")).not.toThrow();
  });

  it("keeps CLI adapters unavailable without an exact bundled compatibility record", async () => {
    expect(bundledCliCompatibilityRecordCount()).toBe(0);

    for (const productId of ["codex-cli", "copilot-cli"] as const) {
      const result = await ADAPTER_REGISTRY[productId].execute(executeRequestFor(productId));
      expect(result.receipt.outcome).toBe("transport-failed");
      expect(result.receipt.productId).toBe(productId);
      expect(result.result.issues).toEqual([]);
      expect(ExecutionResultSchema.safeParse(result).success).toBe(true);
    }
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
    expect(LOCAL_HTTP_PRODUCT_IDS).toHaveLength(2);
  });
});
