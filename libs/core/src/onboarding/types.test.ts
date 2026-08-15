import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { CANDIDATE_PRODUCT_IDS } from "../schemas/config/transports.js";
import * as onboardingTypes from "./types.js";

const PREFERENCES = {
  defaultLenses: ["correctness"],
  agentExecution: "sequential",
} as const;

function runnableState(configurationInput: Record<string, unknown>) {
  return {
    kind: "runnable",
    configurationInput,
    selectedModelId: null,
    conformanceStatus: "not-tested",
    acknowledgement: { status: "required" },
    ...PREFERENCES,
  };
}

describe("onboarding state", () => {
  it.each([
    {
      family: "hosted-api",
      input: {
        transportFamily: "hosted-api",
        productId: "qwen",
        endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        region: "international",
        workspace: "workspace-reference",
        credential: { kind: "environment" },
      },
    },
    {
      family: "local-http",
      input: {
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint: "http://127.0.0.1:1234/v1",
        authentication: "none",
        presetId: "lm-studio",
      },
    },
    {
      family: "local-cli",
      input: {
        transportFamily: "local-cli",
        productId: "codex-cli",
        installationId: "codex-installation",
      },
    },
  ])("parses a dynamic $family setup plan from its V2 input", ({ family, input }) => {
    const state = onboardingTypes.OnboardingStateSchema.parse(runnableState(input));

    expect(state.kind).toBe("runnable");
    expect(state.configurationInput.transportFamily).toBe(family);
    expect(state.plan.transportFamily).toBe(family);
    expect(state.plan.productId).toBe(input.productId);
  });

  it("requires explicit acknowledgement of the exact selected product notice", () => {
    const input = runnableState({
      transportFamily: "hosted-api",
      productId: "mistral",
      endpoint: "https://api.mistral.ai/v1",
      region: "global",
      credential: { kind: "literal", value: "write-only-value" },
    });
    const notice = PRODUCT_REGISTRY.mistral.notice;

    expect(onboardingTypes.OnboardingStateSchema.safeParse(input).success).toBe(true);
    expect(
      onboardingTypes.OnboardingStateSchema.safeParse({
        ...input,
        acknowledgement: {
          status: "accepted",
          noticeId: notice.id,
          noticeVersion: notice.noticeVersion,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }).success,
    ).toBe(true);
    expect(
      onboardingTypes.OnboardingStateSchema.safeParse({
        ...input,
        acknowledgement: {
          status: "accepted",
          noticeId: notice.id,
          noticeVersion: notice.noticeVersion + 1,
          acceptedAt: "2026-07-31T12:00:00.000Z",
        },
      }).success,
    ).toBe(false);
    expect(
      onboardingTypes.OnboardingStateSchema.safeParse({ ...input, acknowledgement: true }).success,
    ).toBe(false);
  });

  it("has no onboarding state for any excluded product", () => {
    for (const productId of CANDIDATE_PRODUCT_IDS) {
      expect(
        onboardingTypes.OnboardingStateSchema.safeParse(
          runnableState({
            transportFamily: "hosted-api",
            productId,
            endpoint: "https://example.com/v1",
          }),
        ).success,
      ).toBe(false);
    }
  });
});
