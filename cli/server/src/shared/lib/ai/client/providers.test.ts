import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import {
  CANDIDATE_PRODUCT_IDS,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  REMOVED_PRODUCT_IDS,
  RUNNABLE_PRODUCT_IDS,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import type { EvidenceKey, ExecutionLimits } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdmittedExecutionPlan } from "../admission/service.js";
import { ADAPTER_REGISTRY, getAdapter } from "../providers/registry.js";
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

function admittedPlan(productId: RunnableProductId): AdmittedExecutionPlan {
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

describe("createFromAdmittedPlan registry routing", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("covers every runnable product with a one-to-one registry adapter", () => {
    expect(Object.keys(ADAPTER_REGISTRY).sort()).toEqual([...RUNNABLE_PRODUCT_IDS].sort());
    for (const productId of RUNNABLE_PRODUCT_IDS) {
      expect(getAdapter(productId).productId).toBe(productId);
    }
  });

  it.each(
    RUNNABLE_PRODUCT_IDS,
  )("creates a client for %s via the exhaustive adapter registry without fallback", async (productId) => {
    const { createFromAdmittedPlan } = await loadCreate();
    const result = createFromAdmittedPlan(admittedPlan(productId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe(productId);
    expect(result.value.modelId).toBe(suggestedModelId(productId));
    expect(result.value.transportFamily).toBe(PRODUCT_REGISTRY[productId].transportFamily);
  });

  it.each([
    ...REMOVED_PRODUCT_IDS,
    ...CANDIDATE_PRODUCT_IDS.slice(0, 3),
  ])("has no adapter for forbidden product %s", async (productId) => {
    expect(() => getAdapter(productId)).toThrow(/Adapter unavailable/);

    const { createFromAdmittedPlan } = await loadCreate();
    const plan = Object.freeze({
      ...admittedPlan("gemini"),
      productId,
      evidenceKey: Object.freeze({
        ...evidenceKeyFor("gemini"),
        productId,
      }),
    }) as unknown as AdmittedExecutionPlan;
    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("rejects REMOVED_PRODUCT_ID as a removed decoder-only product", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = Object.freeze({
      ...admittedPlan("gemini"),
      productId: REMOVED_PRODUCT_ID,
      evidenceKey: Object.freeze({
        ...evidenceKeyFor("gemini"),
        productId: REMOVED_PRODUCT_ID,
        modelId: "glm-4.7",
      }),
    }) as unknown as AdmittedExecutionPlan;

    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("passes the admitted plan tuple unchanged to adapter execute", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const productId = "groq" as const;
    const plan = admittedPlan(productId);
    const clientResult = createFromAdmittedPlan(plan);
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute("review prompt");
    expect(execution.receipt.productId).toBe(productId);
    expect(execution.receipt.modelId).toBe(suggestedModelId(productId));
    expect(execution.result.issues).toEqual([]);
  });
});
