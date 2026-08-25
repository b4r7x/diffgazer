import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { LENS_IDS } from "../schemas/review/index.js";
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
      defaultLenses: [...LENS_IDS],
      agentExecution: "sequential",
    });
  });

  it("uses local HTTP defaults without hosted or CLI credential fields", () => {
    expect(getInitialWizardData("local-openai").configurationInput).toEqual({
      transportFamily: "local-http",
      productId: "local-openai",
      endpoint: "http://127.0.0.1:1234/v1",
      authentication: "none",
      presetId: "lm-studio",
    });
    expect(getInitialWizardData("ollama").configurationInput).toEqual({
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://127.0.0.1:11434",
      authentication: "none",
    });
  });

  it("starts local CLI setup with no credential or inferred installation", () => {
    expect(getInitialWizardData("codex-cli").configurationInput).toEqual({
      transportFamily: "local-cli",
      productId: "codex-cli",
    });
  });

  it("resets every tuple-bound gate when the product changes", () => {
    const deepseek = getInitialWizardData("deepseek");
    if (deepseek.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...deepseek,
      configurationInput: {
        ...deepseek.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "deepseek-v4-flash",
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.deepseek.notice.id,
        noticeVersion: PRODUCT_REGISTRY.deepseek.notice.noticeVersion,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
      defaultLenses: ["security"],
      agentExecution: "parallel",
    } satisfies OnboardingDraft;

    expect(resetWizardProduct(configured, "local-openai")).toEqual({
      ...getInitialWizardData("local-openai"),
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });
  });
});
