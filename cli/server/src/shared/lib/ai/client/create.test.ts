import { CANDIDATE_PRODUCT_IDS, RUNNABLE_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadCreate,
  setupClientTestHome,
  teardownClientTestHome,
} from "../../testing/ai-client-env.js";
import {
  clientTestAdmittedPlan,
  clientTestEvidenceKey,
  suggestedClientTestModelId,
} from "../../testing/ai-client-fixtures.js";
import type { AdmittedExecutionPlan } from "../admission/service.js";
import { ADAPTER_REGISTRY } from "../providers/registry.js";

describe("createFromAdmittedPlan", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("binds exact provider and model identity from the admitted plan", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = clientTestAdmittedPlan("gemini", { modelId: "gemini-explicit-model" });
    const result = createFromAdmittedPlan(plan);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe("gemini");
    expect(result.value.modelId).toBe("gemini-explicit-model");
    expect(result.value.transportFamily).toBe("hosted-api");
    expect(result.value.configurationId).toBe(plan.configurationId);
    expect(result.value.executionFingerprint).toBe(plan.executionFingerprint);
  });

  it.each(
    CANDIDATE_PRODUCT_IDS.slice(0, 3),
  )("rejects candidate product %s before adapter dispatch", async (productId) => {
    const { createFromAdmittedPlan } = await loadCreate();
    const plan = Object.freeze({
      ...clientTestAdmittedPlan("gemini"),
      productId,
      evidenceKey: Object.freeze({
        ...clientTestEvidenceKey("gemini", { modelId: suggestedClientTestModelId("gemini") }),
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
    const clientResult = createFromAdmittedPlan(clientTestAdmittedPlan("gemini"));
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute("review this diff");
    expect(execution.receipt.outcome).not.toBe("completed");
    expect(execution.result.issues).toEqual([]);
  });

  it("returns zero findings for malformed adapter output without prose salvage", async () => {
    const { createFromAdmittedPlan } = await loadCreate();
    const clientResult = createFromAdmittedPlan(clientTestAdmittedPlan("gemini"));
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
    const result = createFromAdmittedPlan(clientTestAdmittedPlan(productId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe(productId);
    expect(result.value.modelId).toBe(suggestedClientTestModelId(productId));
    expect(ADAPTER_REGISTRY[productId].productId).toBe(productId);
  });
});
