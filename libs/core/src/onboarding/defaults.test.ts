import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { LENS_IDS } from "../schemas/review/index.js";
import { getInitialWizardData, type OnboardingDraft, resetWizardProduct } from "./defaults.js";

describe("family-specific onboarding defaults", () => {
  it("starts hosted setup without inferring a credential, model, conformance, or notice", () => {
    const data = getInitialWizardData("gemini");

    expect(data.configurationInput).toEqual({
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    });
    expect(data).toMatchObject({
      selectedModelId: null,
      conformanceStatus: "not-tested",
      acknowledgement: { status: "required" },
      defaultLenses: [...LENS_IDS],
      agentExecution: "sequential",
    });
  });

  it("defaults each hosted regional tuple only from its selected endpoint profile", () => {
    expect(getInitialWizardData("qwen").configurationInput).toEqual({
      transportFamily: "hosted-api",
      productId: "qwen",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      region: "international",
    });
    expect(getInitialWizardData("moonshot").configurationInput).toEqual({
      transportFamily: "hosted-api",
      productId: "moonshot",
      endpoint: "https://api.moonshot.cn/v1",
      region: "mainland",
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
    const qwen = getInitialWizardData("qwen");
    if (qwen.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...qwen,
      configurationInput: {
        ...qwen.configurationInput,
        workspace: "workspace-reference",
        credential: { kind: "environment" },
      },
      selectedModelId: "qwen3-coder-flash",
      conformanceStatus: "passed",
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.qwen.notice.id,
        noticeVersion: PRODUCT_REGISTRY.qwen.notice.noticeVersion,
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
