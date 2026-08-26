import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { SELECTABLE_LENS_IDS } from "../schemas/review/index.js";
import { getInitialWizardData, type OnboardingDraft, resetWizardProduct } from "./defaults.js";

describe("family-specific onboarding defaults", () => {
  it("starts hosted setup without inferring a credential, model, or notice", () => {
    const data = getInitialWizardData("gemini");

    expect(data.configurationInput).toEqual({
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    });
    expect(data).toMatchObject({
      selectedModelId: null,
      acknowledgement: { status: "required" },
      defaultLenses: [...SELECTABLE_LENS_IDS],
      agentExecution: "sequential",
    });
  });

  it("resets every tuple-bound gate when the product changes", () => {
    const zai = getInitialWizardData("zai");
    const configured = {
      ...zai,
      configurationInput: {
        ...zai.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "glm-4.7",
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.zai.notice.id,
        noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
      defaultLenses: ["security"],
      agentExecution: "parallel",
    } satisfies OnboardingDraft;

    expect(resetWizardProduct(configured, "gemini")).toEqual({
      ...getInitialWizardData("gemini"),
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });
  });
});
