/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { type ClientConfigurationAction, READINESS_PRESENTATION } from "../schemas/config/index.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";
import { OnboardingStateSchema } from "./types.js";
import { useWizardState, type WizardSaveCallbacks } from "./use-wizard-state.js";

const ACCEPTED_AT = "2026-07-31T12:00:00.000Z";

function readyDraft(productId: "qwen" | "local-openai" = "qwen"): OnboardingDraft {
  const draft = getInitialWizardData(productId);
  const notice = PRODUCT_REGISTRY[productId].notice;
  return {
    ...draft,
    configurationInput:
      productId === "qwen"
        ? {
            transportFamily: "hosted-api",
            productId: "qwen",
            endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            region: "international",
            workspace: "workspace-reference",
            credential: { kind: "environment" },
          }
        : draft.configurationInput,
    selectedModelId: productId === "qwen" ? "qwen3-coder-flash" : "local-model",
    conformanceStatus: "passed",
    acknowledgement: {
      status: "accepted",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
      acceptedAt: ACCEPTED_AT,
    },
  };
}

function configurationSummary(
  data: OnboardingDraft,
  selectedModelId: string | null = null,
  revision = 3,
) {
  if (data.configurationInput.transportFamily !== "hosted-api") {
    throw new Error("Test fixture requires hosted configuration");
  }
  return {
    configurationId: "created-configuration",
    revision,
    status: "supported" as const,
    transportFamily: "hosted-api" as const,
    productId: data.configurationInput.productId,
    endpoint: data.configurationInput.endpoint,
    region: data.configurationInput.region,
    workspace: data.configurationInput.workspace,
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

function makeCallbacks(
  handler?: (action: ClientConfigurationAction) => Promise<unknown>,
): WizardSaveCallbacks {
  let revision = 3;
  let modelSelected = false;
  return {
    saveSettings: vi.fn(async () => {}),
    runConfigurationAction: vi.fn(
      handler ??
        (async (action) => {
          const data = readyDraft();
          if (action.action === "create") {
            return {
              action: "create",
              status: "succeeded",
              configuration: configurationSummary(data, null, revision),
            };
          }
          if (action.action === "select") {
            revision = Math.max(revision, 4);
            modelSelected = true;
            return {
              action: "select",
              status: "succeeded",
              configuration: configurationSummary(data, action.modelId, revision),
            };
          }
          if (action.action === "update") {
            revision = Math.max(revision, 5);
            return {
              action: "update",
              status: "succeeded",
              configuration: configurationSummary(data, data.selectedModelId, revision),
            };
          }
          if (action.action === "test") {
            return {
              action: "test",
              status: "succeeded",
              configuration: configurationSummary(
                data,
                modelSelected ? data.selectedModelId : null,
                revision,
              ),
              readiness: modelSelected ? readyReadiness(data) : discoveryReadiness(data),
            };
          }
          if (action.action === "delete") {
            return {
              action: "delete",
              status: "succeeded",
            };
          }
          return { action: action.action, status: "succeeded" };
        }),
    ),
  };
}

describe("useWizardState", () => {
  it("derives steps from the selected product plan and resets the full tuple atomically", () => {
    const { result } = renderHook(() => useWizardState({ initial: getInitialWizardData("qwen") }));

    expect(result.current.steps).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);

    act(() => {
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "qwen",
          endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          region: "international",
          workspace: "stale-workspace",
          credential: { kind: "literal", value: "write-only" },
        },
        selectedModelId: "qwen3-coder-flash",
      });
      result.current.setProduct("local-openai");
    });

    expect(result.current.steps).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
    expect(result.current.wizardData).toEqual(getInitialWizardData("local-openai"));
    if (result.current.wizardData.kind !== "runnable") throw new Error("Expected runnable state");
    expect(JSON.stringify(result.current.wizardData.configurationInput)).not.toMatch(
      /workspace|credential|region|qwen3-coder-flash/,
    );
    expect(result.current.stepIndex).toBe(0);
  });

  it("evaluates rapid navigation against the latest step without skipping or underflowing", () => {
    const { result } = renderHook(() =>
      useWizardState({ initial: getInitialWizardData("codex-cli") }),
    );

    act(() => {
      result.current.next();
      result.current.next();
    });
    expect(result.current.currentStep).toBe("authentication");
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.canProceed).toBe(false);

    act(() => {
      result.current.back();
      result.current.back();
    });
    expect(result.current.currentStep).toBe("product");
    expect(result.current.stepIndex).toBe(0);
  });

  it("evaluates rapid product changes against the latest selection", () => {
    const { result } = renderHook(() => useWizardState({ initial: getInitialWizardData("qwen") }));

    act(() => {
      result.current.setProduct("local-openai");
      result.current.setProduct("qwen");
    });

    expect(result.current.wizardData).toEqual(getInitialWizardData("qwen"));
    expect(result.current.stepIndex).toBe(0);
  });

  it("uses the shorter local CLI plan without inventing endpoint or credential fields", () => {
    const { result } = renderHook(() => useWizardState({ initial: getInitialWizardData("qwen") }));

    act(() => result.current.setProduct("codex-cli"));

    expect(result.current.steps).toEqual([
      "product",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
    expect(result.current.wizardData).toEqual(getInitialWizardData("codex-cli"));
    if (result.current.wizardData.kind !== "runnable") throw new Error("Expected runnable state");
    expect(JSON.stringify(result.current.wizardData.configurationInput)).not.toMatch(
      /endpoint|credential|apiKey/,
    );
  });

  it("invalidates conformance and acknowledgement when the exact tuple or model changes", () => {
    const { result } = renderHook(() => useWizardState({ initial: readyDraft() }));

    act(() => result.current.updateData({ selectedModelId: "qwen3-coder-plus" }));
    expect(result.current.wizardData).toMatchObject({
      selectedModelId: "qwen3-coder-plus",
      conformanceStatus: "not-tested",
      acknowledgement: { status: "required" },
    });

    act(() =>
      result.current.updateData({
        conformanceStatus: "passed",
        acknowledgement: {
          status: "accepted",
          noticeId: PRODUCT_REGISTRY.qwen.notice.id,
          noticeVersion: PRODUCT_REGISTRY.qwen.notice.noticeVersion,
          acceptedAt: ACCEPTED_AT,
        },
      }),
    );
    act(() =>
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "qwen",
          endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          region: "international",
          workspace: "new-workspace",
          credential: { kind: "environment" },
        },
      }),
    );

    expect(result.current.wizardData).toMatchObject({
      conformanceStatus: "not-tested",
      acknowledgement: { status: "required" },
    });
  });

  it("keeps removed legacy data untouched until the explicit delete action", async () => {
    const removed = OnboardingStateSchema.parse({
      kind: "removed",
      productId: "zai-coding",
      configurationId: "legacy-zai-coding",
      expectedRevision: 7,
    });
    const callbacks = makeCallbacks();
    const { result, unmount } = renderHook(() => useWizardState({ initial: removed, callbacks }));

    expect(result.current.steps).toEqual(["migration", "delete"]);
    expect(result.current.canProceed).toBe(true);
    act(() => result.current.next());
    expect(result.current.currentStep).toBe("delete");
    expect(result.current.canProceed).toBe(false);
    await act(async () => {
      await result.current.cleanupCreatedConfiguration();
      unmount();
    });
    expect(callbacks.runConfigurationAction).not.toHaveBeenCalled();

    const mounted = renderHook(() => useWizardState({ initial: removed, callbacks }));
    await act(async () => {
      expect(await mounted.result.current.deleteRemovedConfiguration()).toBe(true);
    });
    expect(callbacks.runConfigurationAction).toHaveBeenCalledWith({
      action: "delete",
      configurationId: "legacy-zai-coding",
      expectedRevision: 7,
    });
  });

  it("revokes a newly created partial configuration on abandon with its exact revision", async () => {
    const data = readyDraft();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "select") throw new Error("selection failed");
      return { action: action.action, status: "succeeded" };
    });
    const { result, unmount } = renderHook(() => useWizardState({ initial: data, callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });
    await act(async () => unmount());

    expect(callbacks.runConfigurationAction).toHaveBeenLastCalledWith({
      action: "delete",
      configurationId: "created-configuration",
      expectedRevision: 3,
    });
  });

  it("uses the latest returned revision when selection fails after updating the configuration", async () => {
    const data = readyDraft();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "test") {
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(data),
          readiness: discoveryReadiness(data),
        };
      }
      if (action.action === "select") {
        return {
          action: "select",
          status: "failed",
          configuration: configurationSummary(data, data.selectedModelId, 4),
        };
      }
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
      await result.current.cleanupCreatedConfiguration();
    });

    expect(callbacks.runConfigurationAction).toHaveBeenLastCalledWith({
      action: "delete",
      configurationId: "created-configuration",
      expectedRevision: 4,
    });
  });

  it("revokes a newly created partial configuration before switching products", async () => {
    const data = readyDraft();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "select") throw new Error("selection failed");
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    await act(async () => {
      await result.current.complete();
    });
    await act(async () => {
      result.current.setProduct("local-openai");
      await Promise.resolve();
    });

    expect(callbacks.runConfigurationAction).toHaveBeenLastCalledWith({
      action: "delete",
      configurationId: "created-configuration",
      expectedRevision: 3,
    });
    expect(result.current.wizardData).toEqual(getInitialWizardData("local-openai"));
    if (result.current.wizardData.kind !== "runnable") throw new Error("Expected runnable state");
    expect(JSON.stringify(result.current.wizardData.configurationInput)).not.toMatch(
      /workspace|credential|region/,
    );
  });

  it("waits for an in-flight create before switching and revokes only the partial configuration", async () => {
    let releaseCreate: (() => void) | undefined;
    const createStarted = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    let resolveCreate: ((value: unknown) => void) | undefined;
    const createResponse = new Promise<unknown>((resolve) => {
      resolveCreate = resolve;
    });
    const data = readyDraft();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        releaseCreate?.();
        return createResponse;
      }
      if (action.action === "select") throw new Error("selection failed");
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    let completion: Promise<boolean> | undefined;
    act(() => {
      completion = result.current.complete();
    });
    await createStarted;
    act(() => result.current.setProduct("local-openai"));
    expect(result.current.isReconciling).toBe(true);
    expect(result.current.wizardData.plan.productId).toBe("qwen");

    resolveCreate?.({
      action: "create",
      status: "succeeded",
      configuration: configurationSummary(data),
    });
    await act(async () => {
      await completion;
    });

    expect(callbacks.runConfigurationAction).toHaveBeenLastCalledWith({
      action: "delete",
      configurationId: "created-configuration",
      expectedRevision: 3,
    });
    expect(result.current.wizardData).toEqual(getInitialWizardData("local-openai"));
    expect(result.current.isReconciling).toBe(false);
  });

  it("revokes a stale pending save when acknowledgement, conformance, or preferences change", async () => {
    let releaseSettings: (() => void) | undefined;
    const settingsStarted = new Promise<void>((resolve) => {
      releaseSettings = resolve;
    });
    const data = readyDraft();
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi.fn(async () => {
      await settingsStarted;
    });
    const onComplete = vi.fn();
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks, onComplete }));

    let completion: Promise<boolean> | undefined;
    act(() => {
      completion = result.current.complete();
    });

    act(() => {
      result.current.updateData({ acknowledgement: { status: "required" } });
      result.current.updateData({ conformanceStatus: "not-tested" });
      result.current.updateData({ defaultLenses: ["security"] });
      result.current.updateData({ agentExecution: "parallel" });
    });
    expect(result.current.wizardData).toMatchObject({
      acknowledgement: { status: "required" },
      conformanceStatus: "not-tested",
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });

    releaseSettings?.();
    await act(async () => {
      expect(await completion).toBe(false);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(callbacks.runConfigurationAction).toHaveBeenLastCalledWith({
      action: "delete",
      configurationId: "created-configuration",
      expectedRevision: 5,
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("does not delete a completed configuration during cleanup", async () => {
    const callbacks = makeCallbacks();
    const { result, unmount } = renderHook(() =>
      useWizardState({ initial: readyDraft(), callbacks }),
    );

    await act(async () => {
      expect(await result.current.complete()).toBe(true);
      unmount();
    });

    expect(callbacks.runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete" }),
    );
  });

  it("scrubs a literal credential and does not persist twice when completion initially fails", async () => {
    const base = readyDraft();
    if (base.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected hosted configuration");
    }
    const data = {
      ...base,
      configurationInput: {
        ...base.configurationInput,
        credential: { kind: "literal", value: "write-only-secret" },
      },
    } satisfies OnboardingDraft;
    const callbacks = makeCallbacks();
    const onComplete = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("navigation failed"))
      .mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useWizardState({ initial: data, callbacks, onComplete }),
    );

    await act(async () => {
      expect(await result.current.complete()).toBe(true);
    });
    expect(result.current.error).toBe(
      "Configuration saved, but completion failed: navigation failed",
    );
    expect(JSON.stringify(result.current.wizardData)).not.toContain("write-only-secret");

    await act(async () => {
      expect(await result.current.complete()).toBe(true);
    });

    expect(result.current.error).toBeNull();
    expect(callbacks.runConfigurationAction).toHaveBeenCalledTimes(5);
    expect(callbacks.runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete" }),
    );
    unmount();
  });

  it("single-flights removed deletion and never repeats it after completion fails", async () => {
    const removed = OnboardingStateSchema.parse({
      kind: "removed",
      productId: "zai-coding",
      configurationId: "legacy-zai-coding",
      expectedRevision: 7,
    });
    let resolveDelete: ((response: unknown) => void) | undefined;
    const deleteResponse = new Promise<unknown>((resolve) => {
      resolveDelete = resolve;
    });
    const callbacks = makeCallbacks(async () => deleteResponse);
    const onComplete = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("navigation failed"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWizardState({ initial: removed, callbacks, onComplete }),
    );

    let deletion: Promise<boolean> | undefined;
    await act(async () => {
      deletion = result.current.deleteRemovedConfiguration();
      expect(await result.current.deleteRemovedConfiguration()).toBe(false);
      resolveDelete?.({ action: "delete", status: "succeeded" });
      expect(await deletion).toBe(true);
    });
    expect(result.current.error).toBe(
      "Configuration deleted, but completion failed: navigation failed",
    );

    await act(async () => {
      expect(await result.current.deleteRemovedConfiguration()).toBe(true);
    });

    expect(result.current.error).toBeNull();
    expect(callbacks.runConfigurationAction).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("treats equivalent configuration updates as no-ops", () => {
    const initial = readyDraft();
    const { result } = renderHook(() => useWizardState({ initial }));
    const before = result.current.wizardData;
    const hostedInput = initial.configurationInput;

    if (hostedInput.transportFamily !== "hosted-api") {
      throw new Error("Expected a hosted configuration");
    }
    act(() =>
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: hostedInput.productId,
          endpoint: hostedInput.endpoint,
          region: hostedInput.region,
          workspace: hostedInput.workspace,
          credential: { kind: "environment" },
        },
      }),
    );

    expect(result.current.wizardData).toBe(before);
    expect(result.current.wizardData).toMatchObject({
      acknowledgement: { status: "accepted" },
      conformanceStatus: "passed",
    });
  });

  it("keeps the same generation across equivalent initial rerenders", () => {
    const initial = readyDraft();
    const { result, rerender } = renderHook(
      ({ draft }: { draft: OnboardingDraft }) => useWizardState({ initial: draft }),
      { initialProps: { draft: initial } },
    );

    act(() => result.current.next());
    const before = result.current.wizardData;
    const equivalent = {
      ...initial,
      configurationInput: {
        ...initial.configurationInput,
        ...(initial.configurationInput.transportFamily === "hosted-api"
          ? { credential: { kind: "environment" as const } }
          : {}),
      },
    } satisfies OnboardingDraft;

    rerender({ draft: equivalent });

    expect(result.current.stepIndex).toBe(1);
    expect(result.current.wizardData).toBe(before);
  });

  it("does not revoke a completed configuration when selecting the current product", async () => {
    const callbacks = makeCallbacks();
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useWizardState({ initial: readyDraft(), callbacks, onComplete }),
    );

    await act(async () => {
      expect(await result.current.complete()).toBe(true);
    });
    const runConfigurationAction = vi.mocked(callbacks.runConfigurationAction);
    const callsAfterSave = runConfigurationAction.mock.calls.length;

    act(() => result.current.setProduct("qwen"));
    expect(callbacks.runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete" }),
    );

    await act(async () => {
      expect(await result.current.complete()).toBe(true);
    });
    expect(runConfigurationAction).toHaveBeenCalledTimes(callsAfterSave);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("shares cleanup between explicit cleanup and a product switch", async () => {
    const data = readyDraft();
    let resolveDelete: ((response: unknown) => void) | undefined;
    const deleteResponse = new Promise<unknown>((resolve) => {
      resolveDelete = resolve;
    });
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "test") {
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(data, data.selectedModelId),
          readiness: readyReadiness(data),
        };
      }
      if (action.action === "select") throw new Error("selection failed");
      if (action.action === "delete") return deleteResponse;
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });

    let explicitCleanup!: Promise<void>;
    act(() => {
      explicitCleanup = result.current.cleanupCreatedConfiguration();
      result.current.setProduct("local-openai");
    });
    expect(result.current.isReconciling).toBe(true);

    resolveDelete?.({ action: "delete", status: "succeeded" });
    await act(async () => {
      await explicitCleanup;
      await Promise.resolve();
    });

    expect(
      vi
        .mocked(callbacks.runConfigurationAction)
        .mock.calls.filter(([action]) => action.action === "delete"),
    ).toHaveLength(1);
    expect(result.current.wizardData).toEqual(getInitialWizardData("local-openai"));
    expect(result.current.isReconciling).toBe(false);
  });

  it("applies the latest initial state after an in-flight cleanup", async () => {
    const initial = readyDraft();
    const replacement = getInitialWizardData("local-openai");
    let resolveDelete: ((response: unknown) => void) | undefined;
    const deleteResponse = new Promise<unknown>((resolve) => {
      resolveDelete = resolve;
    });
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(initial),
        };
      }
      if (action.action === "test") {
        return {
          action: "test",
          status: "succeeded",
          configuration: configurationSummary(initial, initial.selectedModelId),
          readiness: readyReadiness(initial),
        };
      }
      if (action.action === "select") throw new Error("selection failed");
      if (action.action === "delete") return deleteResponse;
      return { action: action.action, status: "succeeded" };
    });
    const { result, rerender } = renderHook(
      ({ draft }: { draft: OnboardingDraft }) => useWizardState({ initial: draft, callbacks }),
      { initialProps: { draft: initial } },
    );

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });
    rerender({ draft: replacement });

    resolveDelete?.({ action: "delete", status: "succeeded" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.wizardData).toEqual(replacement);
    expect(result.current.stepIndex).toBe(0);
  });

  it("uses generic copy for untrusted provider and CLI-shaped failures", async () => {
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "provider response rejected token=provider-secret at /Users/voitz/.config/vendor/auth.json",
        ),
      );
    const { result } = renderHook(() => useWizardState({ initial: readyDraft(), callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });

    expect(result.current.error).toBe("Setup failed");
    expect(result.current.error).not.toContain("provider-secret");
    expect(result.current.error).not.toContain("/Users/voitz");
  });

  it("redacts configured secrets and user paths before bounding wizard errors", async () => {
    const secret = "literal-wizard-value-9a";
    const data = readyDraft();
    if (data.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected a hosted configuration");
    }
    const literalData = {
      ...data,
      configurationInput: {
        ...data.configurationInput,
        credential: { kind: "literal", value: secret },
      },
    } satisfies OnboardingDraft;
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi
      .fn()
      .mockRejectedValue(
        new Error(
          `Cannot persist ${secret} from /Users/voitz/Projects/private-config/${"é".repeat(700)}`,
        ),
      );
    const { result } = renderHook(() => useWizardState({ initial: literalData, callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });

    const message = result.current.error ?? "";
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("/Users/voitz");
    expect(new TextEncoder().encode(message).byteLength).toBeLessThanOrEqual(512);
  });

  it.each([
    ["Unix executable path", "unable to open /usr/local/bin/diffgazer"],
    ["system binary path", "unable to open /bin/sh"],
    ["service path", "unable to open /srv/diffgazer/auth.db"],
    ["optional software path", "unable to open /opt/diffgazer/auth.db"],
    ["system configuration path", "unable to open /etc/diffgazer/config.cfg"],
    ["Windows Program Files path", "unable to open C:\\Program Files\\Diffgazer\\auth.db"],
    [
      "UNC Program Files path",
      "unable to open \\\\build-host\\ProgramData\\Program Files\\Diffgazer\\auth.db",
    ],
  ])("redacts %s without an untrusted-provider keyword", async (_label, detail) => {
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi.fn().mockRejectedValue(new Error(detail));
    const { result } = renderHook(() => useWizardState({ initial: readyDraft(), callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });

    const message = result.current.error ?? "";
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(detail.split(" ").at(-1));
    expect(new TextEncoder().encode(message).byteLength).toBeLessThanOrEqual(512);
  });

  it.each([
    [
      "home path",
      "unable to open /home/voitz/.config/diffgazer/state.db.",
      "/home/voitz/.config/diffgazer/state.db",
    ],
    ["tilde path", "unable to open ~/Library/diffgazer/state.db,", "~/Library/diffgazer/state.db"],
    [
      "drive user path",
      "unable to open C:\\Users\\voitz\\AppData\\Local\\Diffgazer\\state.db,",
      "C:\\Users\\voitz\\AppData\\Local\\Diffgazer\\state.db",
    ],
    ["relative dot path", "unable to open ./bin/diffgazer.", "./bin/diffgazer"],
    ["relative parent path", "unable to open ../tools/diffgazer, retry", "../tools/diffgazer"],
    ["relative executable path", "unable to open bin/diffgazer (retry)", "bin/diffgazer"],
    ["colon boundary", "unable to open:/usr/local/bin/diffgazer;", "/usr/local/bin/diffgazer"],
    [
      "punctuated Unix path",
      "unable to open (/usr/local/bin/diffgazer),",
      "/usr/local/bin/diffgazer",
    ],
    [
      "punctuated drive path",
      "unable to open [C:\\Program Files\\Diffgazer\\auth.db].",
      "C:\\Program Files\\Diffgazer\\auth.db",
    ],
  ])("redacts %s at punctuation boundaries", async (_label, detail, path) => {
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi.fn().mockRejectedValue(new Error(detail));
    const { result } = renderHook(() => useWizardState({ initial: readyDraft(), callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });

    const message = result.current.error ?? "";
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(path);
    expect(new TextEncoder().encode(message).byteLength).toBeLessThanOrEqual(512);
  });

  it("redacts cleanup errors sent through the mount-independent callback", async () => {
    const secret = "cleanup-wizard-value-9a";
    const data = readyDraft();
    if (data.configurationInput.transportFamily !== "hosted-api") {
      throw new Error("Expected a hosted configuration");
    }
    const literalData = {
      ...data,
      configurationInput: {
        ...data.configurationInput,
        credential: { kind: "literal", value: secret },
      },
    } satisfies OnboardingDraft;
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "select") throw new Error("selection failed");
      if (action.action === "delete") {
        throw new Error(`cleanup failed ${secret} at /Users/voitz/.local/share/diffgazer`);
      }
      const defaults = makeCallbacks();
      return defaults.runConfigurationAction(action);
    });
    const onCleanupError = vi.fn();
    const { result } = renderHook(() =>
      useWizardState({ initial: literalData, callbacks, onCleanupError }),
    );

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
      await result.current.cleanupCreatedConfiguration();
    });

    expect(onCleanupError).toHaveBeenCalledTimes(1);
    const message = onCleanupError.mock.calls[0]?.[0] ?? "";
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("/Users/voitz");
    expect(new TextEncoder().encode(message).byteLength).toBeLessThanOrEqual(512);
  });
});
