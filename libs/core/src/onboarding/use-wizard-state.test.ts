/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_REGISTRY } from "../providers/product-registry.js";
import { type ClientConfigurationAction, READINESS_PRESENTATION } from "../schemas/config/index.js";
import { createDeferred } from "../testing/deferred.js";
import { getInitialWizardData, type OnboardingDraft } from "./defaults.js";
import type { SaveWizardCallbacks } from "./save-wizard.js";
import { useWizardState } from "./use-wizard-state.js";

const ACCEPTED_AT = "2026-07-31T12:00:00.000Z";

function readyDraft(): OnboardingDraft {
  const draft = getInitialWizardData("zai");
  const notice = PRODUCT_REGISTRY.zai.notice;
  return {
    ...draft,
    configurationInput: {
      transportFamily: "hosted-api",
      productId: "zai",
      endpoint: "https://api.z.ai/api/paas/v4",
      credential: { kind: "environment" },
    },
    selectedModelId: "glm-4.7",
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
  const input = data.configurationInput;
  return {
    configurationId: "created-configuration",
    revision,
    status: "supported" as const,
    transportFamily: "hosted-api" as const,
    productId: input.productId,
    endpoint: input.endpoint,
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
  data: OnboardingDraft = readyDraft(),
): SaveWizardCallbacks {
  let revision = 3;
  let modelSelected = false;
  return {
    saveSettings: vi.fn(async () => {}),
    runConfigurationAction: vi.fn(
      handler ??
        (async (action) => {
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
    const { result } = renderHook(() => useWizardState({ initial: getInitialWizardData("zai") }));

    expect(result.current.steps).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "acknowledgement",
    ]);

    act(() => {
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "zai",
          endpoint: "https://api.z.ai/api/paas/v4",
          credential: { kind: "literal", value: "write-only" },
        },
        selectedModelId: "glm-4.7",
      });
      result.current.setProduct("gemini");
    });

    expect(result.current.steps).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "acknowledgement",
    ]);
    expect(result.current.wizardData).toEqual(getInitialWizardData("gemini"));
    expect(JSON.stringify(result.current.wizardData.configurationInput)).not.toMatch(
      /credential|glm-4\.7/,
    );
    expect(result.current.stepIndex).toBe(0);
  });

  it("rejects a configuration input that targets a different product than the stored plan", () => {
    const { result } = renderHook(() =>
      useWizardState({ initial: getInitialWizardData("gemini") }),
    );

    act(() => {
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "zai",
          endpoint: "https://api.z.ai/api/paas/v4",
        },
      });
    });

    expect(result.current.wizardData).toEqual(getInitialWizardData("gemini"));
    expect(result.current.error).toMatch(/cannot change the product/);
  });

  it("applies a configuration input for the product selected in the same batch", () => {
    const { result } = renderHook(() =>
      useWizardState({ initial: getInitialWizardData("gemini") }),
    );

    act(() => {
      result.current.setProduct("zai");
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "zai",
          endpoint: "https://api.z.ai/api/paas/v4",
          credential: { kind: "environment" },
        },
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.wizardData.configurationInput).toMatchObject({
      productId: "zai",
      endpoint: "https://api.z.ai/api/paas/v4",
    });
  });

  it("evaluates rapid navigation against the latest step without skipping or underflowing", () => {
    const { result } = renderHook(() =>
      useWizardState({ initial: getInitialWizardData("gemini") }),
    );

    act(() => {
      result.current.next();
      result.current.next();
    });
    expect(result.current.currentStep).toBe("authentication");
    expect(result.current.stepIndex).toBe(2);
    expect(result.current.canProceed).toBe(false);

    act(() => {
      result.current.back();
      result.current.back();
    });
    expect(result.current.currentStep).toBe("product");
    expect(result.current.stepIndex).toBe(0);
  });

  it("evaluates rapid product changes against the latest selection", () => {
    const { result } = renderHook(() => useWizardState({ initial: getInitialWizardData("zai") }));

    act(() => {
      result.current.setProduct("gemini");
      result.current.setProduct("zai");
    });

    expect(result.current.wizardData).toEqual(getInitialWizardData("zai"));
    expect(result.current.stepIndex).toBe(0);
  });

  it("invalidates acknowledgement when the exact tuple or model changes", () => {
    const { result } = renderHook(() => useWizardState({ initial: readyDraft() }));

    act(() => result.current.updateData({ selectedModelId: "glm-5-turbo" }));
    expect(result.current.wizardData).toMatchObject({
      selectedModelId: "glm-5-turbo",
      acknowledgement: { status: "required" },
    });

    act(() =>
      result.current.updateData({
        acknowledgement: {
          status: "accepted",
          noticeId: PRODUCT_REGISTRY.zai.notice.id,
          noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
          acceptedAt: ACCEPTED_AT,
        },
      }),
    );
    act(() =>
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "zai",
          endpoint: "https://api.z.ai/api/paas/v4",
          credential: { kind: "literal", value: "rotated-credential" },
        },
      }),
    );

    expect(result.current.wizardData).toMatchObject({
      selectedModelId: null,
      acknowledgement: { status: "required" },
    });
  });

  it("enters the acknowledgement step pre-accepted from the provider consent on record", () => {
    const initial = { ...readyDraft(), acknowledgement: { status: "required" as const } };
    const { result } = renderHook(() =>
      useWizardState({
        initial,
        providerConsent: { version: 1, acceptedAt: "2026-08-01T09:00:00.000Z" },
      }),
    );

    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.currentStep).toBe("model");
    expect(result.current.wizardData.acknowledgement).toEqual({ status: "required" });

    act(() => result.current.next());

    expect(result.current.currentStep).toBe("acknowledgement");
    expect(result.current.wizardData.acknowledgement).toEqual({
      status: "accepted",
      noticeId: PRODUCT_REGISTRY.zai.notice.id,
      noticeVersion: PRODUCT_REGISTRY.zai.notice.noticeVersion,
      acceptedAt: "2026-08-01T09:00:00.000Z",
    });
    expect(result.current.canProceed).toBe(true);
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
      result.current.setProduct("gemini");
      await Promise.resolve();
    });

    expect(callbacks.runConfigurationAction).toHaveBeenLastCalledWith({
      action: "delete",
      configurationId: "created-configuration",
      expectedRevision: 3,
    });
    expect(result.current.wizardData).toEqual(getInitialWizardData("gemini"));
    expect(JSON.stringify(result.current.wizardData.configurationInput)).not.toMatch(
      /workspace|credential|region/,
    );
  });

  it("keeps the current product when cleanup fails during a product switch", async () => {
    const data = readyDraft();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        return { action: "create", status: "succeeded", configuration: configurationSummary(data) };
      }
      if (action.action === "delete") {
        throw new Error("cleanup failed at /Users/voitz/.config/diffgazer");
      }
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    await act(async () => {
      await result.current.prepareDraftConfiguration();
    });
    const retainedDraft = result.current.wizardData;

    act(() => result.current.setProduct("gemini"));
    expect(result.current.isReconciling).toBe(true);

    await vi.waitFor(() => expect(result.current.isReconciling).toBe(false));

    expect(result.current.wizardData).toBe(retainedDraft);
    expect(result.current.wizardData.plan.productId).toBe("zai");
    expect(result.current.draftConfiguration?.configurationId).toBe("created-configuration");
    expect(result.current.error).toContain("Failed to remove the incomplete configuration");
    expect(result.current.error).toContain("[REDACTED]");
    expect(result.current.error).not.toContain("/Users/voitz");
    expect(
      vi
        .mocked(callbacks.runConfigurationAction)
        .mock.calls.filter(([action]) => action.action === "create"),
    ).toHaveLength(1);
  });

  it("waits for an in-flight create before switching and revokes only the partial configuration", async () => {
    const createStarted = createDeferred<void>();
    const createResponse = createDeferred<unknown>();
    const data = readyDraft();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        createStarted.resolve();
        return createResponse.promise;
      }
      if (action.action === "select") throw new Error("selection failed");
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    let completion: Promise<boolean> | undefined;
    act(() => {
      completion = result.current.complete();
    });
    await createStarted.promise;
    act(() => result.current.setProduct("gemini"));
    expect(result.current.isReconciling).toBe(true);
    expect(result.current.wizardData.plan.productId).toBe("zai");

    createResponse.resolve({
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
    expect(result.current.wizardData).toEqual(getInitialWizardData("gemini"));
    expect(result.current.isReconciling).toBe(false);
  });

  it("revokes a stale pending save when acknowledgement or preferences change", async () => {
    const settingsStarted = createDeferred<void>();
    const data = readyDraft();
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi.fn(async () => {
      await settingsStarted.promise;
    });
    const onComplete = vi.fn();
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks, onComplete }));

    let completion: Promise<boolean> | undefined;
    act(() => {
      completion = result.current.complete();
    });

    act(() => {
      result.current.updateData({ acknowledgement: { status: "required" } });
      result.current.updateData({ defaultLenses: ["security"] });
      result.current.updateData({ agentExecution: "parallel" });
    });
    expect(result.current.wizardData).toMatchObject({
      acknowledgement: { status: "required" },
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });

    settingsStarted.resolve();
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
    expect(callbacks.runConfigurationAction).toHaveBeenCalledTimes(3);
    expect(callbacks.runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete" }),
    );
    unmount();
  });

  it("re-prepares after back/edit/next during a slow draft create", async () => {
    const initial = readyDraft();
    const firstCreateGate = createDeferred<void>();
    let createCount = 0;
    const baseCallbacks = makeCallbacks();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action !== "create") {
        return baseCallbacks.runConfigurationAction(action);
      }
      createCount += 1;
      if (createCount === 1) {
        await firstCreateGate.promise;
      }
      return {
        action: "create",
        status: "succeeded",
        configuration: configurationSummary(initial, null, 3 + createCount),
      };
    });

    const { result } = renderHook(() => useWizardState({ initial, callbacks }));

    act(() => {
      result.current.next();
      result.current.next();
      result.current.next();
    });
    expect(result.current.currentStep).toBe("model");

    let firstPrepare: Promise<unknown>;
    act(() => {
      firstPrepare = result.current.prepareDraftConfiguration();
    });

    act(() => {
      result.current.back();
      const configurationInput = initial.configurationInput;
      if (configurationInput.transportFamily !== "hosted-api") {
        throw new Error("Expected hosted-api draft for credential edit");
      }
      result.current.updateData({
        configurationInput: {
          ...configurationInput,
          credential: { kind: "literal", value: "new-secret" },
        },
      });
      result.current.next();
    });
    expect(result.current.currentStep).toBe("model");

    await act(async () => {
      firstCreateGate.resolve();
      await firstPrepare!;
      const secondConfiguration = await result.current.prepareDraftConfiguration();
      expect(secondConfiguration?.configurationId).toBe("created-configuration");
    });

    expect(createCount).toBe(2);
  });

  it("deletes a configuration created by an in-flight draft prepare when the wizard unmounts", async () => {
    const initial = readyDraft();
    const createGate = createDeferred<void>();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") {
        await createGate.promise;
        return {
          action: "create",
          status: "succeeded",
          configuration: configurationSummary(initial),
        };
      }
      if (action.action === "delete") {
        return { action: "delete", status: "succeeded" };
      }
      return { action: action.action, status: "succeeded" };
    });

    const { result, unmount } = renderHook(() => useWizardState({ initial, callbacks }));

    act(() => {
      result.current.next();
      result.current.next();
      result.current.next();
    });
    expect(result.current.currentStep).toBe("model");

    let preparePromise: Promise<unknown>;
    act(() => {
      preparePromise = result.current.prepareDraftConfiguration();
    });

    await act(async () => {
      unmount();
    });
    createGate.resolve();
    await act(async () => {
      await preparePromise!.catch(() => {});
    });

    await vi.waitFor(() => {
      expect(callbacks.runConfigurationAction).toHaveBeenCalledWith({
        action: "delete",
        configurationId: "created-configuration",
        expectedRevision: 3,
      });
    });
  });

  it("persists one draft configuration for the current transport tuple", async () => {
    const initial = readyDraft();
    const createResponse = createDeferred<unknown>();
    const callbacks = makeCallbacks(async (action) => {
      if (action.action === "create") return createResponse.promise;
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial, callbacks }));

    let firstPrepare!: ReturnType<typeof result.current.prepareDraftConfiguration>;
    let secondPrepare!: ReturnType<typeof result.current.prepareDraftConfiguration>;
    act(() => {
      firstPrepare = result.current.prepareDraftConfiguration();
      secondPrepare = result.current.prepareDraftConfiguration();
    });

    expect(callbacks.runConfigurationAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      createResponse.resolve({
        action: "create",
        status: "succeeded",
        configuration: configurationSummary(initial),
      });
      const [firstResult, secondResult] = await Promise.all([firstPrepare, secondPrepare]);
      expect(secondResult).toEqual(firstResult);
    });

    expect(result.current.draftConfiguration?.configurationId).toBe("created-configuration");
    expect(callbacks.runConfigurationAction).toHaveBeenCalledTimes(1);
    expect(callbacks.runConfigurationAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create" }),
    );
  });

  it("invalidates the draft configuration when the transport tuple changes", async () => {
    const initial = readyDraft();
    const callbacks = makeCallbacks();
    const { result } = renderHook(() => useWizardState({ initial, callbacks }));

    await act(async () => {
      await result.current.prepareDraftConfiguration();
    });
    expect(result.current.draftConfiguration).not.toBeNull();

    act(() => {
      result.current.updateData({
        configurationInput: {
          transportFamily: "hosted-api",
          productId: "zai",
          endpoint: "https://api.z.ai/api/paas/v4",
          credential: { kind: "literal", value: "a-different-credential" },
        },
      });
    });

    expect(result.current.draftConfiguration).toBeNull();
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
          credential: { kind: "environment" },
        },
      }),
    );

    expect(result.current.wizardData).toBe(before);
    expect(result.current.wizardData).toMatchObject({
      acknowledgement: { status: "accepted" },
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

  it("keeps an in-flight save valid when React discards a render that saw a new initial", async () => {
    const settingsStarted = createDeferred<void>();
    const draft = readyDraft();
    const discarded = getInitialWizardData("gemini");
    const callbacks = makeCallbacks();
    callbacks.saveSettings = vi.fn(async () => {
      await settingsStarted.promise;
    });
    const onComplete = vi.fn();
    const noDecoy: { decoy: OnboardingDraft | null } = { decoy: null };
    const { result, rerender } = renderHook(
      ({ decoy }: { decoy: OnboardingDraft | null }) => {
        // The render-phase update makes React throw this pass away and re-invoke
        // the component with the original draft, the way a transition or a
        // Suspense retry does: the hook body observes `decoy` in a render that
        // never commits.
        const [pending, setPending] = useState(true);
        const initial = pending && decoy ? decoy : draft;
        const state = useWizardState({ initial, callbacks, onComplete });
        if (pending && decoy) setPending(false);
        return state;
      },
      { initialProps: noDecoy },
    );

    let completion: Promise<boolean> | undefined;
    act(() => {
      completion = result.current.complete();
    });
    rerender({ decoy: discarded });

    settingsStarted.resolve();
    await act(async () => {
      expect(await completion).toBe(true);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.wizardData.plan.productId).toBe("zai");
    expect(callbacks.runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete" }),
    );
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

    act(() => result.current.setProduct("zai"));
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
    const deleteResponse = createDeferred<unknown>();
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
      if (action.action === "delete") return deleteResponse.promise;
      return { action: action.action, status: "succeeded" };
    });
    const { result } = renderHook(() => useWizardState({ initial: data, callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(false);
    });

    let explicitCleanup!: Promise<void>;
    act(() => {
      explicitCleanup = result.current.cleanupCreatedConfiguration();
      result.current.setProduct("gemini");
    });
    expect(result.current.isReconciling).toBe(true);

    deleteResponse.resolve({ action: "delete", status: "succeeded" });
    await act(async () => {
      await explicitCleanup;
      await Promise.resolve();
    });

    expect(
      vi
        .mocked(callbacks.runConfigurationAction)
        .mock.calls.filter(([action]) => action.action === "delete"),
    ).toHaveLength(1);
    expect(result.current.wizardData).toEqual(getInitialWizardData("gemini"));
    expect(result.current.isReconciling).toBe(false);
  });

  it("applies the latest initial state after an in-flight cleanup", async () => {
    const initial = readyDraft();
    const replacement = getInitialWizardData("gemini");
    const deleteResponse = createDeferred<unknown>();
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
      if (action.action === "delete") return deleteResponse.promise;
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

    deleteResponse.resolve({ action: "delete", status: "succeeded" });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.wizardData).toEqual(replacement);
    expect(result.current.stepIndex).toBe(0);
  });

  it("completes the save without dispatching a paid conformance test", async () => {
    const callbacks = makeCallbacks();
    const { result } = renderHook(() => useWizardState({ initial: readyDraft(), callbacks }));

    await act(async () => {
      expect(await result.current.complete()).toBe(true);
    });

    expect(callbacks.runConfigurationAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "test" }),
    );
    expect(result.current.error).toBeNull();
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
