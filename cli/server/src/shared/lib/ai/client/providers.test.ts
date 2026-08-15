import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
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
import { ADAPTER_REGISTRY, getAdapter } from "../providers/registry.js";

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
    const result = createFromAdmittedPlan(clientTestAdmittedPlan(productId));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productId).toBe(productId);
    expect(result.value.modelId).toBe(suggestedClientTestModelId(productId));
    expect(result.value.transportFamily).toBe(PRODUCT_REGISTRY[productId].transportFamily);
  });

  it.each(
    CANDIDATE_PRODUCT_IDS.slice(0, 3),
  )("has no adapter for forbidden product %s", async (productId) => {
    expect(() => getAdapter(productId)).toThrow(/Adapter unavailable/);

    const { createFromAdmittedPlan } = await loadCreate();
    const plan = Object.freeze({
      ...clientTestAdmittedPlan("gemini"),
      productId,
      evidenceKey: Object.freeze({
        ...clientTestEvidenceKey("gemini"),
        productId,
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
    const plan = clientTestAdmittedPlan(productId);
    const clientResult = createFromAdmittedPlan(plan);
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const execution = await clientResult.value.execute("review prompt");
    expect(execution.receipt.productId).toBe(productId);
    expect(execution.receipt.modelId).toBe(suggestedClientTestModelId(productId));
    expect(execution.result.issues).toEqual([]);
  });
});
