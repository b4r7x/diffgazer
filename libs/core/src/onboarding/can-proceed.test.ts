import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";

describe("setup-plan progression", () => {
  it("never infers acknowledgement from save, test, or HTTP success", () => {
    const notice = PRODUCT_REGISTRY.zai.notice;
    const initial = getInitialWizardData("zai");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const successfulSignals = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" as const },
      },
      selectedModelId: "glm-5-turbo",
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
    const notice = PRODUCT_REGISTRY.zai.notice;
    const initial = getInitialWizardData("zai");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const data = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "glm-5-turbo",
      acknowledgement: {
        status: "accepted",
        noticeId: notice.id,
        noticeVersion: notice.noticeVersion + 1,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
    } satisfies OnboardingDraft;

    expect(canProceed("acknowledgement", data)).toBe(false);
  });

  // OpenCode Zen suggests no model, so the model step has nothing to fall back
  // on: only an exact ID that live discovery returned may pass, and a rotating
  // alias may not stand in for one.
  it("requires a live-discovered exact model for a product that suggests none", () => {
    const initial = getInitialWizardData("opencode-zen");
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

    expect(initial.selectedModelId).toBeNull();
    expect(canProceed("model", configured)).toBe(false);
    expect(canProceed("model", { ...configured, selectedModelId: "grok-code" })).toBe(true);
    expect(canProceed("model", { ...configured, selectedModelId: "latest" })).toBe(false);
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

  it("does not let a selected model bypass a changed endpoint or missing authentication", () => {
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
      selectedModelId: "glm-4.7",
    } satisfies OnboardingDraft;

    expect(canProceed("model", configured)).toBe(true);
    expect(
      canProceed("model", {
        ...configured,
        configurationInput: {
          ...configured.configurationInput,
          endpoint: "https://api.z.ai/api/paas/beta",
        },
      }),
    ).toBe(false);
    expect(
      canProceed("model", {
        ...configured,
        configurationInput: { ...configured.configurationInput, credential: undefined },
      }),
    ).toBe(false);
  });

  it("requires the hosted configuration fields", () => {
    const hosted = getInitialWizardData("zai");
    if (hosted.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    expect(canProceed("endpoint-binding", hosted)).toBe(true);
    expect(canProceed("authentication", hosted)).toBe(false);
    expect(
      canProceed("authentication", {
        ...hosted,
        configurationInput: {
          ...hosted.configurationInput,
          credential: { kind: "environment" },
        },
      }),
    ).toBe(true);
  });

  it("blocks model progression until the exact admitted policy holds", () => {
    const initial = getInitialWizardData("zai");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const zai = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
    } satisfies OnboardingDraft;
    expect(canProceed("model", zai)).toBe(false);
    expect(canProceed("model", { ...zai, selectedModelId: "glm-latest" })).toBe(false);
    expect(canProceed("model", { ...zai, selectedModelId: "glm-4.7" })).toBe(true);
    expect(canProceed("acknowledgement", { ...zai, selectedModelId: "glm-4.7" })).toBe(false);
  });

  it("rechecks the configured transport before accepting the notice", () => {
    const initial = getInitialWizardData("zai");
    if (initial.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted API configuration");
    }
    const configured = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        credential: { kind: "environment" },
      },
      selectedModelId: "glm-4.7",
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.zai.notice.id,
        noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
    } satisfies OnboardingDraft;

    expect(canProceed("acknowledgement", configured)).toBe(true);
    expect(
      canProceed("acknowledgement", {
        ...configured,
        configurationInput: {
          ...configured.configurationInput,
          endpoint: "https://generativelanguage.googleapis.com/v1beta",
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
