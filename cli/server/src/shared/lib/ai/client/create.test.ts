import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  REMOVED_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import type { EvidenceKey, ExecutionLimits } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdmittedExecutionPlan } from "../admission/service.js";
import { ADAPTER_REGISTRY } from "../providers/registry.js";
import { loadCreate, setupClientTestHome, teardownClientTestHome } from "./client-test-env.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const INSTALLATION_ID = "codex-installation-1";

const LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 32_000,
  maxOutputTokens: 8_000,
  maxResponseBytes: 65_536,
  wallTimeMs: 60_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
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

function evidenceKeyFor(productId: RunnableProductId, modelId: string): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
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
  productId: RunnableProductId,
  modelId = suggestedModelId(productId),
): AdmittedExecutionPlan {
  const evidenceKey = evidenceKeyFor(productId, modelId);
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

function createSource(): string {
  const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "create.ts");
  return readFileSync(sourcePath, "utf8");
}

describe("create.ts source contract", () => {
  it("has no old createAIClient provider switch fallback", () => {
    const source = createSource();
    expect(source).not.toMatch(/\bswitch\s*\(\s*provider\s*\)/);
    expect(source).not.toMatch(/createLanguageModel/);
    expect(source).not.toMatch(/@ai-sdk\/google/);
    expect(source).not.toMatch(/@ai-sdk\/openai-compatible/);
    expect(source).not.toMatch(/@openrouter\/ai-sdk-provider/);
    expect(source).not.toMatch(/zhipu-ai-provider/);
    expect(source).not.toMatch(/from "ai"/);
  });

  it("has no prose salvage helpers", () => {
    const source = createSource();
    expect(source).not.toMatch(/extractJsonObject/);
    expect(source).not.toMatch(/recoverObject/);
    expect(source).not.toMatch(/salvageTruncatedOutput/);
    expect(source).not.toMatch(/salvag/i);
  });
});

describe("createAIClient legacy surface", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("rejects legacy createAIClient without executing a provider switch", async () => {
    const { createAIClient } = await loadCreate();
    const result = createAIClient({
      apiKey: "test-key",
      provider: "gemini",
      model: "gemini-2.5-flash",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
      expect(result.error.message).toContain("createFromAdmittedPlan");
    }
  });
});

describe("createFromAdmittedPlan", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("binds exact provider and model identity from the admitted plan", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = admittedPlan("gemini", "gemini-explicit-model");
    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe("gemini");
    expect(result.value.modelId).toBe("gemini-explicit-model");
    expect(result.value.transportFamily).toBe("hosted-api");
    expect(result.value.configurationId).toBe(plan.configurationId);
    expect(result.value.executionFingerprint).toBe(plan.executionFingerprint);
  });

  it.each([
    ...REMOVED_PRODUCT_IDS,
  ])("rejects removed product %s before adapter dispatch", async (productId) => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = Object.freeze({
      ...admittedPlan("gemini"),
      productId,
      evidenceKey: Object.freeze({
        ...evidenceKeyFor("gemini", suggestedModelId("gemini")),
        productId,
      }),
    }) as unknown as AdmittedExecutionPlan;

    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it.each(
    CANDIDATE_PRODUCT_IDS.slice(0, 3),
  )("rejects candidate product %s before adapter dispatch", async (productId) => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = Object.freeze({
      ...admittedPlan("gemini"),
      productId,
      evidenceKey: Object.freeze({
        ...evidenceKeyFor("gemini", suggestedModelId("gemini")),
        productId,
      }),
    }) as unknown as AdmittedExecutionPlan;

    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("returns zero findings for incomplete adapter output", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const clientResult = createFromAdmittedPlan(admittedPlan("gemini"));
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute("review this diff");
    expect(execution.receipt.outcome).not.toBe("completed");
    expect(execution.result.issues).toEqual([]);
  });

  it("returns zero findings for malformed adapter output without prose salvage", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const clientResult = createFromAdmittedPlan(admittedPlan("gemini"));
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute(
      'Here is JSON wrapped in prose: {"summary":"ignored","issues":[{"id":"a","line":1}]}',
    );
    expect(execution.receipt.outcome).not.toBe("completed");
    expect(execution.result.issues).toEqual([]);
  });

  it.each(
    RUNNABLE_PRODUCT_IDS,
  )("resolves the registry adapter for runnable product %s", async (productId) => {
    const { createFromAdmittedPlan } = await loadCreate();
    const result = createFromAdmittedPlan(admittedPlan(productId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe(productId);
    expect(result.value.modelId).toBe(suggestedModelId(productId));
    expect(ADAPTER_REGISTRY[productId].productId).toBe(productId);
  });
});
