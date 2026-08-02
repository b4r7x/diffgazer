/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { getInitialWizardData, type OnboardingDraft } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationAction,
  ConfigurationInitResponse,
  SettingsConfig,
} from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  READINESS_PRESENTATION,
} from "@diffgazer/core/schemas/config";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const toastError = vi.fn();

vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

let useOnboarding: typeof import("./use-onboarding").useOnboarding;
let useSettings: typeof import("@diffgazer/core/api/hooks").useSettings;
let ApiProvider: typeof import("@diffgazer/core/api/hooks").ApiProvider;
let ConfigProvider: typeof import("@/hooks/use-config").ConfigProvider;

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "terminal",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

function makeInitResponse(
  overrides: Partial<ConfigurationInitResponse> = {},
): ConfigurationInitResponse {
  return {
    schemaVersion: 2,
    configurations: [],
    selectedConfigurationId: null,
    settings: SETTINGS_FIXTURE,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    ...overrides,
  };
}

let mockGetSettings: Mock<BoundApi["getSettings"]>;
let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockExecuteConfigurationAction: Mock<BoundApi["executeConfigurationAction"]>;
let mockLoadConfigurationInit: Mock<BoundApi["loadConfigurationInit"]>;

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    executeConfigurationAction: mockExecuteConfigurationAction,
    loadConfigurationInit: mockLoadConfigurationInit,
  } satisfies BoundApi;
  const { Wrapper } = createTestQueryWrapper({ api, ApiProvider });

  return ({ children }: { children: ReactNode }) =>
    createElement(Wrapper, null, createElement(ConfigProvider, null, children));
}

function readyDraft(productId: "mistral" | "gemini" = "mistral"): OnboardingDraft {
  const draft = getInitialWizardData(productId);
  const notice = PRODUCT_REGISTRY[productId].notice;
  if (draft.configurationInput.transportFamily !== "hosted-api") {
    throw new Error("Expected hosted draft");
  }
  return {
    ...draft,
    configurationInput: {
      ...draft.configurationInput,
      credential: { kind: "environment" },
    },
    selectedModelId: productId === "gemini" ? "gemini-2.5-flash" : "mistral-small-2603",
    conformanceStatus: "passed",
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: "2026-07-31T12:00:00.000Z",
    },
  };
}

function configurationSummary(
  data: OnboardingDraft,
  selectedModelId: string | null = null,
  revision = 3,
) {
  const input = data.configurationInput;
  if (input.transportFamily === "hosted-api") {
    return {
      configurationId: "created-configuration",
      revision,
      status: "supported" as const,
      transportFamily: "hosted-api" as const,
      productId: input.productId,
      endpoint: input.endpoint,
      region: input.region,
      workspace: input.workspace,
      selectedModelId,
      notices: [
        {
          id: PRODUCT_REGISTRY[data.plan.productId].notice.id,
          noticeVersion: PRODUCT_REGISTRY[data.plan.productId].notice.noticeVersion,
          acknowledgement: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgement,
          acknowledgeBefore: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgeBefore,
          renewAcknowledgementOn:
            PRODUCT_REGISTRY[data.plan.productId].notice.renewAcknowledgementOn,
          billing: [...PRODUCT_REGISTRY[data.plan.productId].notice.billing],
          privacy: [...PRODUCT_REGISTRY[data.plan.productId].notice.privacy],
        },
      ],
      availableActions: ["inspect", "select", "test", "update", "delete"] as const,
    };
  }
  if (input.transportFamily === "local-http") {
    return {
      configurationId: "created-configuration",
      revision,
      status: "supported" as const,
      transportFamily: "local-http" as const,
      productId: input.productId,
      endpoint: input.endpoint,
      authentication: input.authentication,
      presetId: input.presetId,
      selectedModelId,
      notices: [
        {
          id: PRODUCT_REGISTRY[data.plan.productId].notice.id,
          noticeVersion: PRODUCT_REGISTRY[data.plan.productId].notice.noticeVersion,
          acknowledgement: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgement,
          acknowledgeBefore: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgeBefore,
          renewAcknowledgementOn:
            PRODUCT_REGISTRY[data.plan.productId].notice.renewAcknowledgementOn,
          billing: [...PRODUCT_REGISTRY[data.plan.productId].notice.billing],
          privacy: [...PRODUCT_REGISTRY[data.plan.productId].notice.privacy],
        },
      ],
      availableActions: ["inspect", "select", "test", "update", "delete"] as const,
    };
  }
  return {
    configurationId: "created-configuration",
    revision,
    status: "supported" as const,
    transportFamily: "local-cli" as const,
    productId: input.productId,
    installationId: input.installationId,
    selectedModelId,
    notices: [
      {
        id: PRODUCT_REGISTRY[data.plan.productId].notice.id,
        noticeVersion: PRODUCT_REGISTRY[data.plan.productId].notice.noticeVersion,
        acknowledgement: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgement,
        acknowledgeBefore: PRODUCT_REGISTRY[data.plan.productId].notice.acknowledgeBefore,
        renewAcknowledgementOn: PRODUCT_REGISTRY[data.plan.productId].notice.renewAcknowledgementOn,
        billing: [...PRODUCT_REGISTRY[data.plan.productId].notice.billing],
        privacy: [...PRODUCT_REGISTRY[data.plan.productId].notice.privacy],
      },
    ],
    availableActions: ["inspect", "select", "test", "update", "delete"] as const,
  };
}

function readyReadiness(data: OnboardingDraft) {
  if (data.acknowledgement.status !== "accepted") {
    throw new Error("Test fixture requires an accepted acknowledgement");
  }
  return {
    status: "ready" as const,
    ready: true as const,
    evidenceStatus: "passed" as const,
    checkedAt: "2026-07-31T12:01:00.000Z",
    acknowledgement: data.acknowledgement,
    ...READINESS_PRESENTATION.ready,
  };
}

function discoveryReadiness(data: OnboardingDraft) {
  const notice = PRODUCT_REGISTRY[data.plan.productId].notice;
  return {
    status: "acknowledgement-required" as const,
    ready: false as const,
    evidenceStatus: "passed" as const,
    checkedAt: "2026-07-31T12:01:00.000Z",
    acknowledgement: {
      status: "required" as const,
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
    },
    ...READINESS_PRESENTATION["acknowledgement-required"],
  };
}

function makeActionHandler(
  data: OnboardingDraft,
  overrides?: {
    onSelect?: "throw";
    onDelete?: "throw";
  },
) {
  let revision = 3;
  let modelSelected = false;

  return async (action: ClientConfigurationAction) => {
    if (action.action === "delete" && overrides?.onDelete === "throw") {
      throw new Error("cleanup failed");
    }
    if (action.action === "select" && overrides?.onSelect === "throw") {
      throw new Error("selection failed");
    }
    if (action.action === "create") {
      return ClientConfigurationActionResponseSchema.parse({
        action: "create",
        status: "succeeded",
        configuration: configurationSummary(data, null, revision),
      });
    }
    if (action.action === "select") {
      revision = Math.max(revision, 4);
      modelSelected = true;
      return ClientConfigurationActionResponseSchema.parse({
        action: "select",
        status: "succeeded",
        configuration: configurationSummary(data, action.modelId, revision),
      });
    }
    if (action.action === "update") {
      revision = Math.max(revision, 5);
      return ClientConfigurationActionResponseSchema.parse({
        action: "update",
        status: "succeeded",
        configuration: configurationSummary(data, data.selectedModelId, revision),
      });
    }
    if (action.action === "test") {
      return ClientConfigurationActionResponseSchema.parse({
        action: "test",
        status: "succeeded",
        configuration: configurationSummary(
          data,
          modelSelected ? data.selectedModelId : null,
          revision,
        ),
        readiness: modelSelected ? readyReadiness(data) : discoveryReadiness(data),
      });
    }
    if (action.action === "delete") {
      return ClientConfigurationActionResponseSchema.parse({
        action: "delete",
        status: "succeeded",
      });
    }
    return ClientConfigurationActionResponseSchema.parse({
      action: action.action,
      status: "succeeded",
    });
  };
}

describe("useOnboarding", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ useSettings, ApiProvider } = await import("@diffgazer/core/api/hooks"));
    ({ useOnboarding } = await import("./use-onboarding"));
    ({ ConfigProvider } = await import("@/hooks/use-config"));
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(SETTINGS_FIXTURE);
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockExecuteConfigurationAction = vi
      .fn<BoundApi["executeConfigurationAction"]>()
      .mockImplementation(makeActionHandler(readyDraft("gemini")));
    mockLoadConfigurationInit = vi
      .fn<BoundApi["loadConfigurationInit"]>()
      .mockResolvedValue(makeInitResponse());
  });

  it("invalidates the settings query after onboarding completes", async () => {
    const updatedSettings: SettingsConfig = {
      ...SETTINGS_FIXTURE,
      agentExecution: "sequential",
    };
    mockGetSettings.mockResolvedValueOnce(SETTINGS_FIXTURE).mockResolvedValue(updatedSettings);

    const wrapper = createWrapper();
    const settingsHook = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(settingsHook.result.current.data).toBeDefined());

    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });
    const draft = readyDraft("gemini");

    act(() => {
      onboardingHook.result.current.updateData({
        configurationInput: draft.configurationInput,
        selectedModelId: draft.selectedModelId,
        conformanceStatus: draft.conformanceStatus,
      });
      onboardingHook.result.current.updateData({
        acknowledgement: draft.acknowledgement,
      });
      for (let index = 0; index < draft.plan.steps.length - 1; index += 1) {
        onboardingHook.result.current.next();
      }
    });

    await act(async () => {
      expect(await onboardingHook.result.current.complete()).toBe(true);
    });

    await waitFor(() => {
      expect(settingsHook.result.current.data?.agentExecution).toBe("sequential");
    });
  });

  it("skips hosted credential requirements for local HTTP and local CLI plans", () => {
    const wrapper = createWrapper();
    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });

    act(() => onboardingHook.result.current.setProduct("local-openai"));
    expect(onboardingHook.result.current.steps).not.toContain("api-key");
    if (onboardingHook.result.current.wizardData.kind !== "runnable") {
      throw new Error("Expected runnable wizard data");
    }
    expect(onboardingHook.result.current.wizardData.configurationInput).not.toHaveProperty(
      "credential",
    );

    act(() => onboardingHook.result.current.setProduct("codex-cli"));
    expect(onboardingHook.result.current.steps).toEqual([
      "product",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
    if (onboardingHook.result.current.wizardData.kind !== "runnable") {
      throw new Error("Expected runnable wizard data");
    }
    expect(onboardingHook.result.current.wizardData.configurationInput).not.toHaveProperty(
      "credential",
    );
  });

  it("requires explicit acknowledgement and resets invalid fields when the plan changes", () => {
    const wrapper = createWrapper();
    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });
    const draft = readyDraft("gemini");

    act(() => {
      onboardingHook.result.current.updateData({
        configurationInput: draft.configurationInput,
        selectedModelId: draft.selectedModelId,
        conformanceStatus: "passed",
      });
    });
    if (onboardingHook.result.current.wizardData.kind !== "runnable") {
      throw new Error("Expected runnable wizard data");
    }
    expect(onboardingHook.result.current.wizardData.acknowledgement).toEqual({
      status: "required",
    });

    act(() => onboardingHook.result.current.setProduct("local-openai"));
    if (onboardingHook.result.current.wizardData.kind !== "runnable") {
      throw new Error("Expected runnable wizard data");
    }
    expect(onboardingHook.result.current.wizardData.acknowledgement).toEqual({
      status: "required",
    });
    expect(onboardingHook.result.current.wizardData.conformanceStatus).toBe("not-tested");
    expect(onboardingHook.result.current.wizardData.selectedModelId).toBeNull();
  });

  it("scrubs literal credentials from client state after submit", async () => {
    const secret = "write-only-onboarding-secret";
    const geminiDraft = readyDraft("gemini");
    if (geminiDraft.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted draft");
    }
    const literalDraft: OnboardingDraft = {
      ...geminiDraft,
      configurationInput: {
        ...geminiDraft.configurationInput,
        credential: { kind: "literal", value: secret },
      },
    };
    mockExecuteConfigurationAction.mockImplementation(makeActionHandler(literalDraft));

    const wrapper = createWrapper();
    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });

    act(() => {
      onboardingHook.result.current.updateData({
        configurationInput: literalDraft.configurationInput,
        selectedModelId: literalDraft.selectedModelId,
        conformanceStatus: literalDraft.conformanceStatus,
      });
      onboardingHook.result.current.updateData({
        acknowledgement: literalDraft.acknowledgement,
      });
      for (let index = 0; index < literalDraft.plan.steps.length - 1; index += 1) {
        onboardingHook.result.current.next();
      }
    });

    await act(async () => {
      const succeeded = await onboardingHook.result.current.complete();
      expect(succeeded).toBe(true);
    });

    expect(JSON.stringify(onboardingHook.result.current.wizardData)).not.toContain(secret);
  });

  it("reports cleanup failures through a toast without rethrowing", async () => {
    const draft = readyDraft("gemini");
    mockExecuteConfigurationAction.mockImplementation(
      makeActionHandler(draft, { onSelect: "throw", onDelete: "throw" }),
    );

    const wrapper = createWrapper();
    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });

    act(() => {
      onboardingHook.result.current.updateData({
        configurationInput: draft.configurationInput,
        selectedModelId: draft.selectedModelId,
        conformanceStatus: draft.conformanceStatus,
      });
      onboardingHook.result.current.updateData({
        acknowledgement: draft.acknowledgement,
      });
      for (let index = 0; index < draft.plan.steps.length - 1; index += 1) {
        onboardingHook.result.current.next();
      }
    });

    await act(async () => {
      expect(await onboardingHook.result.current.complete()).toBe(false);
      await onboardingHook.result.current.cleanupCreatedConfiguration();
    });

    expect(toastError).toHaveBeenCalledWith(
      "Cleanup Failed",
      expect.objectContaining({
        message: expect.stringContaining("Failed to remove the incomplete configuration"),
      }),
    );
  });
});
