import { describe, expect, it, vi } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import type { ClientConfigurationAction, RunnableProductId } from "../schemas/config/index.js";
import { makeReadiness } from "../testing/provider-fixtures.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";
import {
  buildConfigPayload,
  buildSelectPayload,
  buildSettingsPayload,
  buildUpdatePayload,
  saveWizard,
} from "./save-wizard.js";

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

  it("serializes review preferences and the provider consent the notice step recorded", () => {
    const data = {
      ...qwen(),
      defaultLenses: ["security"],
      agentExecution: "parallel",
    } satisfies OnboardingDraft;

    expect(buildSettingsPayload(data)).toEqual({
      defaultLenses: ["security"],
      agentExecution: "parallel",
      providerConsent: { version: 1, acceptedAt: ACCEPTED_AT },
    });
    expect(() =>
      buildSettingsPayload({ ...data, acknowledgement: { status: "required" } }),
    ).toThrow();
  });
});

describe("saveWizard", () => {
  it("persists settings, the exact model, and the explicit notice without a paid conformance test", async () => {
    const data = qwen();
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
    ]);
    expect(runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "test" }),
    );
  });

  it("completes with store-aligned readiness projection without a pre-select test", async () => {
    const data = qwen();
    const productId = data.plan.productId;
    const actions: ClientConfigurationAction[] = [];
    let revision = 1;

    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      actions.push(action);
      if (action.action === "create") {
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(data, "configuration-1", null, revision),
          readiness: makeReadiness("model-missing", productId),
        };
      }
      if (action.action === "select") {
        revision = 2;
        return {
          action: "select",
          status: "succeeded",
          configuration: configurationSummary(
            data,
            action.configurationId,
            action.modelId,
            revision,
          ),
        };
      }
      if (action.action === "update") {
        revision = 3;
        return {
          action: "update",
          status: "succeeded",
          configuration: configurationSummary(
            data,
            action.configurationId,
            data.selectedModelId,
            revision,
          ),
        };
      }
      throw new Error(`Unexpected action ${action.action}`);
    });

    await expect(
      saveWizard(data, { saveSettings: vi.fn(async () => {}), runConfigurationAction }),
    ).resolves.toEqual({
      status: "complete",
      configurationId: "configuration-1",
    });
    expect(actions.map(({ action }) => action)).toEqual(["create", "select", "update"]);
    expect(makeReadiness("model-missing", productId).evidenceStatus).toBe("failed");
  });

  it("rejects a select response that does not match the explicit selected tuple", async () => {
    const data = qwen();
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "select") {
        return {
          action: "select",
          status: "succeeded",
          configuration: configurationSummary(data, action.configurationId, "qwen-latest", 2),
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
    const actions: ClientConfigurationAction[] = [];
    const runConfigurationAction = vi.fn(async (action: ClientConfigurationAction) => {
      actions.push(action);
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
    expect(actions.map(({ action }) => action)).toEqual(["create", "select"]);
  });
});
