import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import type { RunnableProductId } from "../schemas/config/index.js";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";

function hostedDraft(
  productId: RunnableProductId,
  overrides: Partial<OnboardingDraft> = {},
): OnboardingDraft {
  const initial = getInitialWizardData(productId);
  if (initial.configurationInput.transportFamily !== "hosted-api") {
    throw new Error("Expected hosted API configuration");
  }
  return {
    ...initial,
    configurationInput: {
      ...initial.configurationInput,
      credential: { kind: "environment" },
    },
    ...overrides,
  };
}

describe("setup-plan progression", () => {
  it("never infers acknowledgement from save, test, or HTTP success", () => {
    const notice = PRODUCT_REGISTRY.zai.notice;
    // The extra fields are the point: a saved configuration, a passing test and
    // a 200 are success signals canProceed must not read as an acknowledgement.
    const successfulSignals = {
      ...hostedDraft("zai", { selectedModelId: "glm-5-turbo" }),
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
    const data = hostedDraft("zai", {
      selectedModelId: "glm-5-turbo",
      acknowledgement: {
        status: "accepted",
        noticeId: notice.id,
        noticeVersion: notice.noticeVersion + 1,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
    });

    expect(canProceed("acknowledgement", data)).toBe(false);
  });

  // OpenCode Zen suggests no model, so the model step has nothing to fall back
  // on: only an exact ID that live discovery returned may pass, and a rotating
  // alias may not stand in for one.
  it("requires a live-discovered exact model for a product that suggests none", () => {
    const configured = hostedDraft("opencode-zen");

    expect(configured.selectedModelId).toBeNull();
    expect(canProceed("model", configured)).toBe(false);
    expect(canProceed("model", { ...configured, selectedModelId: "grok-code" })).toBe(true);
    expect(canProceed("model", { ...configured, selectedModelId: "latest" })).toBe(false);
  });

  it("rejects latest aliases even when the product policy accepts discovered exact IDs", () => {
    const configured = hostedDraft("gemini");

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
    expect(canProceed("model", hostedDraft("openrouter", { selectedModelId }))).toBe(false);
  });

  it("requires an exact downstream provider/model pair for OpenRouter", () => {
    const configured = hostedDraft("openrouter");

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
    const configured = hostedDraft("gemini");
    const clearedCredential = {
      ...configured,
      configurationInput: {
        ...configured.configurationInput,
        credential: { kind: "literal" as const, value: "" },
      },
    } satisfies OnboardingDraft;

    expect(canProceed("endpoint-binding", clearedCredential)).toBe(true);
    expect(canProceed("authentication", clearedCredential)).toBe(false);
  });

  it("does not let a selected model bypass a changed endpoint or missing authentication", () => {
    const configured = hostedDraft("zai", { selectedModelId: "glm-4.7" });

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
    const configured = hostedDraft("zai");
    const withoutCredential = {
      ...configured,
      configurationInput: { ...configured.configurationInput, credential: undefined },
    } satisfies OnboardingDraft;

    expect(canProceed("endpoint-binding", withoutCredential)).toBe(true);
    expect(canProceed("authentication", withoutCredential)).toBe(false);
    expect(canProceed("authentication", configured)).toBe(true);
  });

  it("blocks model progression until the exact admitted policy holds", () => {
    const zai = hostedDraft("zai");

    expect(canProceed("model", zai)).toBe(false);
    expect(canProceed("model", { ...zai, selectedModelId: "glm-latest" })).toBe(false);
    expect(canProceed("model", { ...zai, selectedModelId: "glm-4.7" })).toBe(true);
    expect(canProceed("acknowledgement", { ...zai, selectedModelId: "glm-4.7" })).toBe(false);
  });

  it("rechecks the configured transport before accepting the notice", () => {
    const configured = hostedDraft("zai", {
      selectedModelId: "glm-4.7",
      acknowledgement: {
        status: "accepted",
        noticeId: PRODUCT_REGISTRY.zai.notice.id,
        noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
        acceptedAt: "2026-07-31T12:00:00.000Z",
      },
    });

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
    const data = hostedDraft("gemini");

    expect(
      canProceed("product", {
        ...data,
        configurationInput: { ...data.configurationInput, productId: "zai" },
      }),
    ).toBe(false);
  });
});
