import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY, SELECTABLE_PRODUCT_IDS } from "../providers/product-registry.js";
import { READINESS_PRESENTATION, type Readiness } from "../schemas/config/readiness.js";
import { CANDIDATE_PRODUCT_IDS, type RunnableProductId } from "../schemas/config/transports.js";
import { buildSetupPlan } from "./setup-plan.js";

const LOCAL_API_INCOMPATIBLE_READINESS = {
  status: "local-api-incompatible",
  ready: false,
  evidenceStatus: "failed",
  checkedAt: "2026-07-31T12:00:00.000Z",
  acknowledgement: {
    status: "required",
    noticeId: PRODUCT_REGISTRY["local-openai"].notice.id,
    noticeVersion: PRODUCT_REGISTRY["local-openai"].notice.noticeVersion,
  },
  ...READINESS_PRESENTATION["local-api-incompatible"],
} satisfies Readiness;

function runnablePlan(productId: RunnableProductId) {
  const plan = buildSetupPlan(productId);
  expect(plan?.kind).toBe("runnable");
  if (!plan || plan.kind !== "runnable") throw new Error(`Missing setup plan for ${productId}`);
  return plan;
}

describe("setup plan", () => {
  it("asks hosted products for their exact endpoint tuple and credential", () => {
    const plan = runnablePlan("qwen");

    expect(plan.transportFamily).toBe("hosted-api");
    expect(plan.requiredFields).toEqual(["credential", "region", "workspace"]);
    expect(plan.steps).toMatchObject([
      { id: "product" },
      { id: "endpoint-binding", requiredFields: ["region", "workspace"] },
      {
        id: "authentication",
        credentialKind: "hosted-api-key-reference",
        requiredFields: ["credential"],
      },
      { id: "model" },
      { id: "conformance" },
      { id: "acknowledgement" },
    ]);
  });

  it("asks local HTTP products for loopback and local authentication without a credential", () => {
    const plan = runnablePlan("local-openai");

    expect(plan.transportFamily).toBe("local-http");
    expect(plan.requiredFields).toEqual(["endpoint", "local-authentication"]);
    expect(plan.steps).toMatchObject([
      { id: "product" },
      { id: "endpoint-binding", requiredFields: ["endpoint"] },
      {
        id: "authentication",
        credentialKind: "none-or-optional-local-bearer",
        requiredFields: ["local-authentication"],
      },
      { id: "model" },
      { id: "conformance" },
      { id: "acknowledgement" },
    ]);
    expect(plan.requiredFields).not.toContain("credential");
  });

  it("asks local CLI products only for a selected installation before model checks", () => {
    const plan = runnablePlan("codex-cli");

    expect(plan.transportFamily).toBe("local-cli");
    expect(plan.requiredFields).toEqual(["installation"]);
    expect(plan.steps).toMatchObject([
      { id: "product" },
      {
        id: "authentication",
        credentialKind: "vendor-managed-local-auth",
        requiredFields: ["installation"],
      },
      { id: "model" },
      { id: "conformance" },
      { id: "acknowledgement" },
    ]);
    expect(plan.steps.some((step) => step.id === "endpoint-binding")).toBe(false);
    expect(plan.requiredFields).not.toContain("credential");
  });

  it("requires exact discovered model selection, conformance, and explicit notice acceptance", () => {
    for (const productId of SELECTABLE_PRODUCT_IDS) {
      const plan = runnablePlan(productId);
      const model = plan.steps.find((step) => step.id === "model");
      const conformance = plan.steps.find((step) => step.id === "conformance");
      const acknowledgement = plan.steps.find((step) => step.id === "acknowledgement");

      expect(model).toMatchObject({
        discovery: "configuration-bound",
        selection: "exact",
        aliases: "forbidden",
      });
      expect(conformance).toMatchObject({ action: "test" });
      expect(acknowledgement).toMatchObject({
        acceptance: "explicit",
        notice: PRODUCT_REGISTRY[productId].notice,
      });
    }
  });

  it("projects the current safe readiness remediation into a runnable plan", () => {
    const plan = buildSetupPlan("local-openai", LOCAL_API_INCOMPATIBLE_READINESS);

    expect(plan).toMatchObject({
      kind: "runnable",
      remediation: {
        status: "local-api-incompatible",
        action: "update",
        code: "use-compatible-api",
        message: "Use a supported local server and API configuration.",
      },
    });
  });

  it("gives a removed record only explicit migration and deletion steps", () => {
    const plan = buildSetupPlan("zai-coding");

    expect(plan).toEqual({
      kind: "removed",
      productId: "zai-coding",
      steps: [
        {
          id: "migration",
          action: "create-new-zai-configuration",
          targetProductId: "zai",
          credentialHandling: "retain-until-explicit-delete-never-copy-test-or-send",
        },
        { id: "delete", action: "delete-removed-record" },
      ],
    });
  });

  it("builds no setup plan for any excluded candidate", () => {
    for (const productId of CANDIDATE_PRODUCT_IDS) {
      expect(buildSetupPlan(productId)).toBeNull();
    }
  });
});
