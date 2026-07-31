import { describe, expect, it, vi } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import {
  type ClientConfigurationAction,
  READINESS_PRESENTATION,
  type RunnableProductId,
} from "../schemas/config/index.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";
import {
  buildConfigPayload,
  buildSelectPayload,
  buildSettingsPayload,
  buildUpdatePayload,
  saveWizard,
} from "./save-wizard.js";
import { OnboardingStateSchema } from "./types.js";

const ACCEPTED_AT = "2026-07-31T12:00:00.000Z";

function readyDraft(
  productId: RunnableProductId,
  configurationInput: OnboardingDraft["configurationInput"],
  selectedModelId: string,
): OnboardingDraft {
  const data = getInitialWizardData(productId);
  const notice = PRODUCT_REGISTRY[productId].notice;
  return {
    ...data,
    configurationInput,
    selectedModelId,
    conformanceStatus: "passed",
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: ACCEPTED_AT,
    },
  };
}

const qwen = () =>
  readyDraft(
    "qwen",
    {
      transportFamily: "hosted-api",
      productId: "qwen",
      endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      region: "international",
      workspace: "workspace-reference",
      credential: { kind: "literal", value: "write-only-credential" },
    },
    "qwen3-coder-flash",
  );

function configurationSummary(
  data: OnboardingDraft,
  configurationId = "configuration-1",
  selectedModelId: string | null = null,
  revision = 1,
) {
  const { configurationInput } = data;
  if (configurationInput.transportFamily !== "hosted-api") {
    throw new Error("Test fixture requires a hosted configuration");
  }
  const notice = PRODUCT_REGISTRY[data.plan.productId].notice;
  return {
    configurationId,
    revision,
    status: "supported" as const,
    transportFamily: configurationInput.transportFamily,
    productId: configurationInput.productId,
    endpoint: configurationInput.endpoint,
    region: configurationInput.region,
    ...(configurationInput.workspace ? { workspace: configurationInput.workspace } : {}),
    selectedModelId,
    notices: [
      {
        id: notice.id,
        noticeVersion: notice.noticeVersion,
        acknowledgement: notice.acknowledgement,
        acknowledgeBefore: notice.acknowledgeBefore,
        renewAcknowledgementOn: notice.renewAcknowledgementOn,
        billing: [...notice.billing],
        privacy: [...notice.privacy],
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

describe("wizard payloads", () => {
  it("serializes a hosted credential only in a V2 create action", () => {
    const data = qwen();

    expect(buildConfigPayload(data)).toEqual({
      action: "create",
      input: data.configurationInput,
    });
    expect(JSON.stringify(buildConfigPayload(data))).not.toMatch(/"provider"|"apiKey"/);
  });

  it("serializes an environment credential without an environment name or legacy key", () => {
    const base = qwen();
    if (base.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Qwen fixture must use hosted API transport");
    }
    const data = {
      ...base,
      configurationInput: {
        ...base.configurationInput,
        credential: { kind: "environment" },
      },
    } satisfies OnboardingDraft;

    expect(buildConfigPayload(data)).toMatchObject({
      action: "create",
      input: { credential: { kind: "environment" } },
    });
    expect(JSON.stringify(buildConfigPayload(data))).not.toMatch(/apiKey|varName|environmentName/);
  });

  it("never invents a credential for local HTTP or local CLI", () => {
    const localHttp = readyDraft(
      "local-openai",
      {
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint: "http://127.0.0.1:1234/v1",
        authentication: "none",
        presetId: "lm-studio",
      },
      "local-model",
    );
    const localCli = readyDraft(
      "codex-cli",
      {
        transportFamily: "local-cli",
        productId: "codex-cli",
        installationId: "codex-installation",
      },
      "gpt-5-codex",
    );

    for (const data of [localHttp, localCli]) {
      const serialized = JSON.stringify(buildConfigPayload(data));
      expect(serialized).not.toMatch(/apiKey|credential|bearerToken/);
    }
  });

  it("allows only the explicit write-only local bearer input", () => {
    const data = readyDraft(
      "local-openai",
      {
        transportFamily: "local-http",
        productId: "local-openai",
        endpoint: "http://127.0.0.1:8080/v1",
        authentication: "optional-local-bearer",
        presetId: "llama-cpp",
        bearerToken: { kind: "literal", value: "write-only-bearer" },
      },
      "local-model",
    );

    expect(buildConfigPayload(data)).toMatchObject({
      action: "create",
      input: {
        authentication: "optional-local-bearer",
        bearerToken: { kind: "literal", value: "write-only-bearer" },
      },
    });
  });

  it("emits an exact selected model before notice acknowledgement is persisted", () => {
    const data = qwen();

    expect(buildSelectPayload(data, "configuration-1")).toEqual({
      action: "select",
      configurationId: "configuration-1",
      modelId: "qwen3-coder-flash",
    });
    expect(
      buildSelectPayload(
        {
          ...data,
          acknowledgement: { status: "required" },
        },
        "configuration-1",
      ),
    ).toEqual({
      action: "select",
      configurationId: "configuration-1",
      modelId: "qwen3-coder-flash",
    });
    expect(() =>
      buildSelectPayload({ ...data, selectedModelId: "qwen-latest" }, "configuration-1"),
    ).toThrow("configured transport and exact model");

    expect(buildUpdatePayload(data, "configuration-1", 3)).toEqual({
      action: "update",
      configurationId: "configuration-1",
      expectedRevision: 3,
      input: data.configurationInput,
      acknowledgement: data.acknowledgement,
    });
  });

  it("serializes only non-secret review preferences as settings", () => {
    const data = {
      ...qwen(),
      defaultLenses: ["security"],
      agentExecution: "parallel",
    } satisfies OnboardingDraft;

    expect(buildSettingsPayload(data)).toEqual({
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });
  });
});

describe("saveWizard", () => {
  it("persists settings, the explicit notice, exact model, and production-path test", async () => {
    const data = { ...qwen(), conformanceStatus: "not-tested" as const };
    const actions: ClientConfigurationAction[] = [];
    const saveSettings = vi.fn(async () => {});
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      actions.push(action);
      if (action.action === "create") {
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(data),
        };
      }
      if (action.action === "test") {
        const selected = actions.some((candidate) => candidate.action === "select");
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(
            data,
            action.configurationId,
            selected ? data.selectedModelId : null,
            selected ? 3 : 1,
          ),
          readiness: selected ? readyReadiness(data) : discoveryReadiness(data),
        };
      }
      if (action.action === "select") {
        return {
          action: "select",
          status: "succeeded",
          configuration: configurationSummary(data, action.configurationId, action.modelId, 2),
        };
      }
      if (action.action === "update") {
        return {
          action: "update",
          status: "succeeded",
          configuration: configurationSummary(
            data,
            action.configurationId,
            data.selectedModelId,
            3,
          ),
        };
      }
      throw new Error(`Unexpected action ${action.action}`);
    });

    await expect(saveWizard(data, { saveSettings, runConfigurationAction })).resolves.toEqual({
      status: "complete",
      configurationId: "configuration-1",
    });
    expect(actions).toEqual([
      {
        action: "create",
        input: data.configurationInput,
      },
      { action: "test", configurationId: "configuration-1" },
      {
        action: "select",
        configurationId: "configuration-1",
        modelId: "qwen3-coder-flash",
      },
      {
        action: "update",
        configurationId: "configuration-1",
        expectedRevision: 2,
        input: data.configurationInput,
        acknowledgement: data.acknowledgement,
      },
      { action: "test", configurationId: "configuration-1" },
    ]);
  });

  it("rejects a discovery response that selects a model before explicit select", async () => {
    const data = { ...qwen(), selectedModelId: null, conformanceStatus: "not-tested" as const };
    const actions: ClientConfigurationAction[] = [];
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      actions.push(action);
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "test") {
        const selected = actions.some((candidate) => candidate.action === "select");
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(
            data,
            action.configurationId,
            // This is intentionally non-null: test must not be able to select
            // or persist a model before the explicit select action.
            "qwen3-coder-flash",
            selected ? 3 : 1,
          ),
          readiness: selected
            ? readyReadiness({ ...data, selectedModelId: "qwen3-coder-flash" })
            : discoveryReadiness(data),
        };
      }
      if (action.action === "select") {
        return {
          action: "select",
          status: "succeeded",
          configuration: configurationSummary(data, action.configurationId, action.modelId, 2),
        };
      }
      if (action.action === "update") {
        return {
          action: "update",
          status: "succeeded",
          configuration: configurationSummary(data, action.configurationId, "qwen3-coder-flash", 3),
        };
      }
      throw new Error(`Unexpected action ${action.action}`);
    });

    await expect(
      saveWizard(data, { saveSettings: vi.fn(async () => {}), runConfigurationAction }),
    ).resolves.toMatchObject({
      status: "partial",
      completedSteps: ["settings", "configuration"],
    });
    expect(actions.map(({ action }) => action)).toEqual(["create", "test"]);
  });

  it("preserves removed zai-coding data without calling a mutation", async () => {
    const removed = OnboardingStateSchema.parse({
      kind: "removed",
      productId: "zai-coding",
      configurationId: "legacy-zai-coding",
      expectedRevision: 2,
    });
    const callbacks = {
      saveSettings: vi.fn(),
      runConfigurationAction: vi.fn(),
    };

    await expect(saveWizard(removed, callbacks)).resolves.toEqual({
      status: "preserved-removed",
      configurationId: "legacy-zai-coding",
    });
    expect(callbacks.saveSettings).not.toHaveBeenCalled();
    expect(callbacks.runConfigurationAction).not.toHaveBeenCalled();
  });

  it("returns a partial result without creating a configuration when settings fail", async () => {
    const saveSettings = vi.fn(async () => {
      throw new Error("settings failed");
    });
    const runConfigurationAction = vi.fn();

    await expect(
      saveWizard(qwen(), { saveSettings, runConfigurationAction }),
    ).resolves.toMatchObject({
      status: "partial",
      completedSteps: [],
    });
    expect(runConfigurationAction).not.toHaveBeenCalled();
  });

  it("reports a created configuration when model selection fails", async () => {
    const data = qwen();
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      if (action.action === "create") {
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(data),
        };
      }
      throw new Error("selection failed");
    });

    await expect(
      saveWizard(data, { saveSettings: vi.fn(async () => {}), runConfigurationAction }),
    ).resolves.toMatchObject({
      status: "partial",
      completedSteps: ["settings", "configuration"],
    });
  });

  it("fails closed when the production-path test omits readiness evidence", async () => {
    const data = qwen();
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      if (action.action === "create") {
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(data),
        };
      }
      if (action.action === "test") {
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(data, action.configurationId, data.selectedModelId),
        };
      }
      return { action: "select", status: "succeeded" };
    });

    await expect(
      saveWizard(data, { saveSettings: vi.fn(async () => {}), runConfigurationAction }),
    ).resolves.toMatchObject({
      status: "partial",
      completedSteps: ["settings", "configuration"],
    });
  });

  it("rejects readiness evidence for a different accepted notice", async () => {
    const data = qwen();
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      if (action.action === "create") {
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(data),
        };
      }
      if (action.action === "test") {
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(data, action.configurationId, data.selectedModelId),
          readiness: {
            ...readyReadiness(data),
            acknowledgement: {
              ...data.acknowledgement,
              noticeId: "different-product-notice",
            },
          },
        };
      }
      return { action: "select", status: "succeeded" };
    });

    await expect(
      saveWizard(data, { saveSettings: vi.fn(async () => {}), runConfigurationAction }),
    ).resolves.toMatchObject({
      status: "partial",
      completedSteps: ["settings", "configuration"],
    });
  });
});
