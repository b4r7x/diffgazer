import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import { READINESS_PRESENTATION, type Readiness } from "../schemas/config/readiness.js";
import { CANDIDATE_PRODUCT_IDS, type RunnableProductId } from "../schemas/config/transports.js";
import { buildSetupPlan } from "./setup-plan.js";

const CONFORMANCE_FAILED_READINESS = {
  status: "conformance-failed",
  ready: false,
  evidenceStatus: "failed",
  checkedAt: "2026-07-31T12:00:00.000Z",
  acknowledgement: {
    status: "required",
    noticeId: PRODUCT_REGISTRY.zai.notice.id,
    noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
  },
  ...READINESS_PRESENTATION["conformance-failed"],
} satisfies Readiness;

function runnablePlan(productId: RunnableProductId) {
  const plan = buildSetupPlan(productId);
  expect(plan?.kind).toBe("runnable");
  if (!plan) throw new Error(`Missing setup plan for ${productId}`);
  return plan;
}

describe("setup plan", () => {
  it("asks hosted products for their endpoint tuple and credential", () => {
    const plan = runnablePlan("zai");

    expect(plan.transportFamily).toBe("hosted-api");
    expect(plan.steps).toMatchObject([
      { id: "product" },
      { id: "endpoint-binding", endpoints: PRODUCT_REGISTRY.zai.configuration.endpoints },
      {
        id: "authentication",
        credentialKind: "hosted-api-key-reference",
      },
      { id: "model" },
      { id: "acknowledgement" },
    ]);
  });

  it("keeps the hosted step order for every hosted product", () => {
    const plan = runnablePlan("gemini");

    expect(plan.transportFamily).toBe("hosted-api");
    expect(plan.steps.map((step) => step.id)).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "acknowledgement",
    ]);
  });

  it("requires exact discovered model selection and explicit notice acceptance", () => {
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      const plan = runnablePlan(productId);
      const model = plan.steps.find((step) => step.id === "model");
      const acknowledgement = plan.steps.find((step) => step.id === "acknowledgement");

      expect(model).toMatchObject({
        discovery: "configuration-bound",
        selection: "exact",
        aliases: "forbidden",
      });
      expect(acknowledgement).toMatchObject({
        acceptance: "explicit",
        notice: PRODUCT_REGISTRY[productId].notice,
      });
    }
  });

  it("projects the current safe readiness remediation into a runnable plan", () => {
    const plan = buildSetupPlan("zai", CONFORMANCE_FAILED_READINESS);

    expect(plan).toMatchObject({
      kind: "runnable",
      remediation: {
        status: "conformance-failed",
        action: "test",
        code: "rerun-conformance",
        message: READINESS_PRESENTATION["conformance-failed"].remediation.message,
      },
    });
  });

  it("builds no setup plan for any excluded candidate", () => {
    for (const productId of CANDIDATE_PRODUCT_IDS) {
      expect(buildSetupPlan(productId)).toBeNull();
    }
  });
});
