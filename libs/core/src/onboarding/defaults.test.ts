import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { LENS_IDS } from "../schemas/review/index.js";
import { canProceed } from "./can-proceed.js";
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

describe("setup-plan progression", () => {
  it("requires only the selected family's configuration fields", () => {
    const qwen = getInitialWizardData("qwen");
    if (qwen.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    expect(canProceed("endpoint-binding", qwen)).toBe(false);
    expect(
      canProceed("endpoint-binding", {
        ...qwen,
        configurationInput: { ...qwen.configurationInput, workspace: "workspace-reference" },
      }),
    ).toBe(true);
    expect(canProceed("authentication", qwen)).toBe(false);
    expect(
      canProceed("authentication", {
        ...qwen,
        configurationInput: {
          ...qwen.configurationInput,
          workspace: "workspace-reference",
          credential: { kind: "environment" },
        },
      }),
    ).toBe(true);

    const localHttp = getInitialWizardData("local-openai");
    expect(canProceed("endpoint-binding", localHttp)).toBe(true);
    expect(canProceed("authentication", localHttp)).toBe(true);

    const localCli = getInitialWizardData("codex-cli");
    if (localCli.configurationInput.transportFamily !== "local-cli") {
      throw new Error("Expected local CLI configuration");
    }
    expect(canProceed("endpoint-binding", localCli)).toBe(false);
    expect(canProceed("authentication", localCli)).toBe(false);
    expect(
      canProceed("authentication", {
        ...localCli,
        configurationInput: { ...localCli.configurationInput, installationId: "codex-local" },
      }),
    ).toBe(true);
  });

  it("blocks model and conformance progression until the exact admitted policy holds", () => {
    const initial = getInitialWizardData("deepseek");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const deepseek = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
    } satisfies OnboardingDraft;
    expect(canProceed("model", deepseek)).toBe(false);
    expect(canProceed("model", { ...deepseek, selectedModelId: "deepseek-latest" })).toBe(false);
    expect(canProceed("model", { ...deepseek, selectedModelId: "deepseek-v4-flash" })).toBe(true);
    expect(canProceed("conformance", { ...deepseek, selectedModelId: "deepseek-v4-flash" })).toBe(
      false,
    );
    expect(
      canProceed("conformance", {
        ...deepseek,
        selectedModelId: "deepseek-v4-flash",
        conformanceStatus: "passed",
      }),
    ).toBe(true);
  });

  it("never infers acknowledgement and requires the exact current notice", () => {
    const initial = getInitialWizardData("mistral");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const mistral = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "mistral-small-2603",
      conformanceStatus: "passed",
    } satisfies OnboardingDraft;
    const notice = PRODUCT_REGISTRY.mistral.notice;

    expect(canProceed("acknowledgement", mistral)).toBe(false);
    expect(
      canProceed("acknowledgement", {
        ...mistral,
        acknowledgement: {
          status: "accepted",
          noticeId: notice.id,
          noticeVersion: notice.noticeVersion + 1,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }),
    ).toBe(false);
    expect(
      canProceed("acknowledgement", {
        ...mistral,
        acknowledgement: {
          status: "accepted",
          noticeId: notice.id,
          noticeVersion: notice.noticeVersion,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("rechecks the configured transport before accepting final conformance or notice", () => {
    const initial = getInitialWizardData("deepseek");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "deepseek-v4-flash",
      conformanceStatus: "passed",
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.deepseek.notice.id,
        noticeVersion: PRODUCT_REGISTRY.deepseek.notice.noticeVersion,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
    } satisfies OnboardingDraft;

    expect(canProceed("acknowledgement", configured)).toBe(true);
    expect(
      canProceed("acknowledgement", {
        ...configured,
        configurationInput: {
          ...configured.configurationInput,
          endpoint: "https://api.groq.com/openai/v1",
        },
      }),
    ).toBe(false);
    expect(
      canProceed("acknowledgement", {
        ...configured,
        configurationInput: { ...configured.configurationInput, credential: undefined },
      }),
    ).toBe(false);
  });

  it("rejects stale product plans after direct tuple mutation", () => {
    const data = getInitialWizardData("gemini");
    if (data.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    expect(
      canProceed("product", {
        ...data,
        configurationInput: { ...data.configurationInput, productId: "zai" },
      }),
    ).toBe(false);
  });
});
