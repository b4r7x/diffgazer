import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";

describe("setup-plan progression", () => {
  it("lets local HTTP skip credentials while retaining endpoint and compatibility gates", () => {
    const local = getInitialWizardData("local-openai");

    expect(local.plan.requiredFields).not.toContain("credential");
    expect(canProceed("endpoint-binding", local)).toBe(true);
    expect(canProceed("authentication", local)).toBe(true);
    expect(canProceed("model", local)).toBe(false);
    expect(
      canProceed("model", {
        ...local,
        selectedModelId: "local-model",
      }),
    ).toBe(true);
  });

  it("requires a selected CLI installation and passing compatibility evidence", () => {
    const initial = getInitialWizardData("codex-cli");
    if (initial.configurationInput.transportFamily !== "local-cli") {
      throw new Error("Expected local CLI configuration");
    }
    const compatibilityStep = initial.plan.steps.find((step) => step.id === "conformance");
    const withInstallation = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        installationId: "codex-installation",
      },
    } satisfies OnboardingDraft;
    const withModel = {
      ...withInstallation,
      selectedModelId: "gpt-5-codex",
    } satisfies OnboardingDraft;

    expect(compatibilityStep).toMatchObject({
      requiredChecks: [
        "installation",
        "runtime-version",
        "account-plan",
        "model-discovery",
        "negative-capabilities",
        "structured-output",
        "cancellation",
        "acknowledgement",
      ],
    });
    expect(canProceed("authentication", initial)).toBe(false);
    expect(canProceed("authentication", withInstallation)).toBe(true);
    expect(canProceed("conformance", withModel)).toBe(false);
    expect(
      canProceed("conformance", {
        ...withModel,
        conformanceStatus: "passed",
      }),
    ).toBe(true);
  });

  it("never infers acknowledgement from save, test, or HTTP success", () => {
    const notice = PRODUCT_REGISTRY.mistral.notice;
    const initial = getInitialWizardData("mistral");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const successfulSignals = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" as const },
      },
      selectedModelId: "mistral-small-2603",
      conformanceStatus: "passed",
      saveStatus: "saved",
      testStatus: "passed",
      httpStatus: 200,
    } satisfies OnboardingDraft & {
      readonly saveStatus: "saved";
      readonly testStatus: "passed";
      readonly httpStatus: 200;
    };

    expect(canProceed("acknowledgement", successfulSignals)).toBe(false);
    expect(
      canProceed("acknowledgement", {
        ...successfulSignals,
        acknowledgement: {
          status: "accepted",
          noticeId: notice.id,
          noticeVersion: notice.noticeVersion,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("rejects acknowledgement for a different notice version", () => {
    const notice = PRODUCT_REGISTRY.mistral.notice;
    const initial = getInitialWizardData("mistral");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const data = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "mistral-small-2603",
      conformanceStatus: "passed",
      acknowledgement: {
        status: "accepted",
        noticeId: notice.id,
        noticeVersion: notice.noticeVersion + 1,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
    } satisfies OnboardingDraft;

    expect(canProceed("acknowledgement", data)).toBe(false);
  });

  it("rejects latest aliases even when the product policy accepts discovered exact IDs", () => {
    const initial = getInitialWizardData("gemini");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" as const },
      },
    } satisfies OnboardingDraft;

    expect(canProceed("model", { ...configured, selectedModelId: "gemini-latest" })).toBe(false);
    expect(canProceed("model", { ...configured, selectedModelId: "gemini-2.5-flash" })).toBe(true);
  });

  it.each([
    "gpt-4.1-mini",
    "openrouter/auto",
    "openrouter/openrouter",
    "provider/automatic",
    "provider/default",
    "provider/cheapest",
    "provider/free",
    "provider/fallback",
    "provider/exacto",
    "provider/extended",
    "provider/fastest",
    "provider/floor",
    "provider/nitro",
    "provider/online",
    "provider/random",
    "provider/route",
    "provider/openrouter",
    "provider/thinking",
    "openai/gpt-4.1-mini:online",
    "openai/gpt-4.1-mini:nitro",
    "openai/gpt-4.1-mini:free:nitro",
    "openai/gpt-4.1-mini/thinking",
  ] as const)("rejects forged OpenRouter route selector %s", (selectedModelId) => {
    const initial = getInitialWizardData("openrouter");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" as const },
      },
      selectedModelId,
    } satisfies OnboardingDraft;

    expect(canProceed("model", configured)).toBe(false);
  });

  it("requires an exact downstream provider/model pair for OpenRouter", () => {
    const initial = getInitialWizardData("openrouter");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" as const },
      },
    } satisfies OnboardingDraft;

    expect(
      canProceed("model", {
        ...configured,
        selectedModelId: "anthropic/claude-3.7-sonnet",
      }),
    ).toBe(true);
    expect(
      canProceed("model", {
        ...configured,
        selectedModelId: "openrouterish/openrouter-model",
      }),
    ).toBe(true);
    // A pinned variant suffix belongs to the downstream identity, so the pair
    // stays exact and the wizard may proceed on it.
    expect(
      canProceed("model", {
        ...configured,
        selectedModelId: "openai/gpt-4.1-mini:free",
      }),
    ).toBe(true);
    expect(
      canProceed("model", {
        ...configured,
        selectedModelId: "provider/openrouterish",
      }),
    ).toBe(true);
    expect(
      canProceed("model", {
        ...configured,
        selectedModelId: "OpenRouter/claude-3.7-sonnet",
      }),
    ).toBe(false);
  });

  it("fails closed for Z.AI Flash until an explicit model opt-in is represented", () => {
    const initial = getInitialWizardData("zai");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" as const },
      },
      selectedModelId: "glm-4.7-flash",
    } satisfies OnboardingDraft;

    // Discovery, conformance, and the product notice are not model opt-in.
    expect(canProceed("model", configured)).toBe(false);
    expect(
      canProceed("conformance", {
        ...configured,
        conformanceStatus: "passed",
      }),
    ).toBe(false);
    expect(
      canProceed("acknowledgement", {
        ...configured,
        conformanceStatus: "passed",
        acknowledgement: {
          status: "accepted",
          noticeId: PRODUCT_REGISTRY.zai.notice.id,
          noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("lets endpoint-binding proceed after clearing a hosted credential on a later step", () => {
    const initial = getInitialWizardData("gemini");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const clearedCredential = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "literal" as const, value: "" },
      },
    } satisfies OnboardingDraft;

    expect(canProceed("endpoint-binding", clearedCredential)).toBe(true);
    expect(canProceed("authentication", clearedCredential)).toBe(false);
  });

  it("does not let a passed status bypass a changed endpoint or missing authentication", () => {
    const initial = getInitialWizardData("qwen");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        workspace: "workspace-reference",
        credential: { kind: "environment" as const },
      },
      selectedModelId: "qwen3-coder-flash",
      conformanceStatus: "passed",
    } satisfies OnboardingDraft;

    expect(canProceed("conformance", configured)).toBe(true);
    expect(
      canProceed("conformance", {
        ...configured,
        configurationInput: {
          ...configured.configurationInput,
          endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        },
      }),
    ).toBe(false);
    expect(
      canProceed("conformance", {
        ...configured,
        configurationInput: { ...configured.configurationInput, credential: undefined },
      }),
    ).toBe(false);
  });

  it("keeps Qwen Plus unavailable until output-limit and review evidence exists", () => {
    const initial = getInitialWizardData("qwen");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        workspace: "workspace-reference",
        credential: { kind: "environment" as const },
      },
      selectedModelId: "qwen3-coder-plus",
    } satisfies OnboardingDraft;

    // The draft carries only generic conformance status, not the required
    // server-verified output-limit and review-conformance evidence.
    expect(canProceed("model", configured)).toBe(false);
    expect(
      canProceed("conformance", {
        ...configured,
        conformanceStatus: "passed",
      }),
    ).toBe(false);
    expect(
      canProceed("acknowledgement", {
        ...configured,
        conformanceStatus: "passed",
        acknowledgement: {
          status: "accepted",
          noticeId: PRODUCT_REGISTRY.qwen.notice.id,
          noticeVersion: PRODUCT_REGISTRY.qwen.notice.noticeVersion,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }),
    ).toBe(false);

    expect(
      canProceed("conformance", {
        ...configured,
        selectedModelId: "qwen3-coder-flash",
        conformanceStatus: "passed",
      }),
    ).toBe(true);
  });

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

    const localCli = getInitialWizardData("codex-cli");
    expect(canProceed("endpoint-binding", localCli)).toBe(false);
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
