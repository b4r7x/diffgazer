import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import {
  type ClientConfigurationAction,
  ClientConfigurationActionResponseSchema,
  type ClientConfigurationSummary,
  type RunnableProductId,
} from "../schemas/config/index.js";
import { canProceed } from "./can-proceed.js";
import {
  getInitialWizardData,
  type OnboardingConfigurationDraft,
  type OnboardingDraft,
  resetWizardProduct,
} from "./defaults.js";
import { areConfigurationInputsEqual, areDraftsEqual } from "./draft-equality.js";
import { scrubLiteralSecret } from "./draft-secrets.js";
import { getClientSafeError } from "./redact-client-error.js";
import { buildConfigPayload, type SaveWizardCallbacks, saveWizard } from "./save-wizard.js";
import { getStepAt } from "./steps.js";
import type { OnboardingStep } from "./types.js";

const CLEANUP_ERROR_PREFIX = "Failed to remove the incomplete configuration";
const DRAFT_CONFIGURATION_ERROR_PREFIX = "Could not prepare this configuration for model discovery";
const SAVE_COMPLETION_ERROR_PREFIX = "Configuration saved, but completion failed";

export interface UseWizardStateOptions {
  initial?: OnboardingDraft;
  callbacks?: SaveWizardCallbacks;
  onComplete?: () => Promise<void> | void;
  onCleanupError?: (message: string) => void;
}

export interface UseWizardStateResult {
  wizardData: OnboardingDraft;
  stepIndex: number;
  currentStep: OnboardingStep;
  steps: readonly OnboardingStep[];
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  isReconciling: boolean;
  isSubmitting: boolean;
  error: string | null;
  /**
   * The persisted record that configuration-bound model discovery addresses.
   * It is `null` until {@link UseWizardStateResult.prepareDraftConfiguration}
   * has committed a record for the current transport tuple.
   */
  draftConfiguration: ClientConfigurationSummary | null;
  isPreparingDraftConfiguration: boolean;
  prepareDraftConfiguration: () => Promise<ClientConfigurationSummary | null>;
  next: (partial?: OnboardingDraftUpdate) => void;
  back: () => void;
  updateData: (partial: OnboardingDraftUpdate) => void;
  setProduct: (productId: RunnableProductId) => void;
  complete: () => Promise<boolean>;
  cleanupCreatedConfiguration: () => Promise<void>;
  /** Best-effort revoke for tab-close cleanup via {@link SaveWizardCallbacks.revokeConfigurationOnPageHide}. */
  revokeCreatedConfigurationOnPageHide: () => void;
}

type CreatedConfiguration = Pick<ClientConfigurationSummary, "configurationId" | "revision">;
/**
 * A patch for the current draft. `configurationInput` may only refine the
 * product the draft already targets: the product/transport tuple is owned by
 * the stored plan, and {@link UseWizardStateResult.setProduct} is the only
 * product transition. Cross-product input is rejected by
 * {@link keepsProductTuple}.
 */
type OnboardingDraftUpdate = Partial<Omit<OnboardingDraft, "kind" | "plan">>;

/** A committed draft record together with the transport tuple it addresses. */
type PreparedDraftConfiguration = Readonly<{
  input: OnboardingConfigurationDraft;
  configuration: ClientConfigurationSummary;
}>;

type CleanupResult =
  | { readonly success: true }
  | { readonly success: false; readonly cause: unknown };

interface WizardState {
  readonly data: OnboardingDraft;
  readonly stepIndex: number;
  readonly error: string | null;
}

function invalidatesAcknowledgement(
  current: OnboardingDraft,
  partial: OnboardingDraftUpdate,
): boolean {
  if (
    partial.configurationInput &&
    !areConfigurationInputsEqual(partial.configurationInput, current.configurationInput)
  ) {
    return true;
  }
  if (
    partial.selectedModelId !== undefined &&
    partial.selectedModelId !== current.selectedModelId
  ) {
    return true;
  }
  return partial.conformanceStatus !== undefined && partial.conformanceStatus !== "passed";
}

function updateRunnableDraft(
  current: OnboardingDraft,
  partial: OnboardingDraftUpdate,
): OnboardingDraft {
  const configurationChanged =
    partial.configurationInput !== undefined &&
    !areConfigurationInputsEqual(partial.configurationInput, current.configurationInput);
  const next = { ...current, ...partial };
  if (!invalidatesAcknowledgement(current, partial)) return next;

  return {
    ...next,
    ...(configurationChanged ? { selectedModelId: null } : {}),
    ...(partial.configurationInput || partial.selectedModelId !== undefined
      ? { conformanceStatus: "not-tested" as const }
      : {}),
    acknowledgement: { status: "required" },
  };
}

/**
 * The product/transport tuple belongs to the stored plan, so a draft patch may
 * only refine the product the draft already targets. `setProduct` stays the
 * exclusive product transition, and a draft can never pair one product's
 * configuration with another product's plan.
 */
function keepsProductTuple(current: OnboardingDraft, partial: OnboardingDraftUpdate): boolean {
  const input = partial.configurationInput;
  if (!input) return true;
  return (
    input.productId === current.plan.productId &&
    input.transportFamily === current.plan.transportFamily
  );
}

const CROSS_PRODUCT_UPDATE_ERROR =
  "Onboarding draft updates cannot change the product; select the product first.";

export function useWizardState(options: UseWizardStateOptions = {}): UseWizardStateResult {
  const { initial = getInitialWizardData(), callbacks, onComplete, onCleanupError } = options;
  const [wizardState, setWizardState] = useState<WizardState>(() => ({
    data: initial,
    stepIndex: 0,
    error: null,
  }));
  const [isReconciling, setIsReconciling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preparedDraft, setPreparedDraft] = useState<PreparedDraftConfiguration | null>(null);
  const [isPreparingDraftConfiguration, setIsPreparingDraftConfiguration] = useState(false);
  const createdConfigurationRef = useRef<CreatedConfiguration | null>(null);
  // The ref is the authority for the async guard; the state copy only drives
  // rendering and would be stale inside back-to-back prepare calls.
  const preparedDraftRef = useRef<PreparedDraftConfiguration | null>(null);
  const pendingDraftRef = useRef<Promise<ClientConfigurationSummary> | null>(null);
  const pendingSaveRef = useRef<Promise<boolean> | null>(null);
  const pendingCleanupRef = useRef<Promise<CleanupResult> | null>(null);
  const reportedCleanupRef = useRef<Promise<CleanupResult> | null>(null);
  const hasCommittedRef = useRef(false);
  const generationRef = useRef(0);
  const generationDataRef = useRef<OnboardingDraft>(initial);
  const initialRef = useRef<OnboardingDraft>(initial);
  const latestInitialRef = useRef<OnboardingDraft>(initial);
  const requestedProductRef = useRef<RunnableProductId | null>(null);
  const reconciliationRef = useRef(0);

  const { data: wizardData, stepIndex, error } = wizardState;
  const steps = wizardData.plan.steps.map((step) => step.id);
  const currentStep = getStepAt(wizardData.plan, stepIndex);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const canProceedNow = canProceed(currentStep, wizardData);
  // A persisted draft is only addressable while it still describes the edited
  // transport tuple. Model selection alone must not invalidate it.
  const activeDraftConfiguration =
    preparedDraft !== null &&
    areConfigurationInputsEqual(preparedDraft.input, wizardData.configurationInput)
      ? preparedDraft.configuration
      : null;

  const runConfigurationAction = async (action: ClientConfigurationAction) => {
    if (!callbacks) throw new Error("Wizard callbacks are required");
    const response = ClientConfigurationActionResponseSchema.parse(
      await callbacks.runConfigurationAction(action),
    );
    if (
      action.action === "create" &&
      response.action === action.action &&
      response.status === "succeeded" &&
      response.configuration
    ) {
      createdConfigurationRef.current = response.configuration;
    } else if (
      action.action !== "delete" &&
      response.action === action.action &&
      response.configuration &&
      createdConfigurationRef.current?.configurationId === response.configuration.configurationId &&
      response.configuration.revision >= createdConfigurationRef.current.revision
    ) {
      createdConfigurationRef.current = response.configuration;
    }
    return response;
  };

  const ensureGenerationFor = useCallback((data: OnboardingDraft) => {
    if (areDraftsEqual(generationDataRef.current, data)) return;
    generationDataRef.current = data;
    generationRef.current += 1;
    hasCommittedRef.current = false;
    pendingDraftRef.current = null;
  }, []);

  const finishCommittedOperation = async (generation: number) => {
    if (generation !== generationRef.current) return false;
    setWizardState((current) => ({ ...current, error: null }));
    try {
      await onComplete?.();
    } catch (cause) {
      if (generation !== generationRef.current) return false;
      setWizardState((current) => ({
        ...current,
        error: `${SAVE_COMPLETION_ERROR_PREFIX}: ${getClientSafeError(cause, "Retry completion.", wizardData)}`,
      }));
      return true;
    }
    return generation === generationRef.current;
  };

  const removeCreatedConfiguration = useCallback(async (): Promise<boolean> => {
    const created = createdConfigurationRef.current;
    if (!created || !callbacks) return false;
    const action = {
      action: "delete",
      configurationId: created.configurationId,
      expectedRevision: created.revision,
    } as const;
    const response = ClientConfigurationActionResponseSchema.parse(
      await callbacks.runConfigurationAction(action),
    );
    if (response.action !== "delete" || response.status !== "succeeded") {
      throw new Error("Configuration delete did not succeed");
    }
    if (
      createdConfigurationRef.current?.configurationId === created.configurationId &&
      createdConfigurationRef.current.revision === created.revision
    ) {
      createdConfigurationRef.current = null;
      preparedDraftRef.current = null;
      setPreparedDraft(null);
      // Deleting a partial configuration invalidates the commit marker even
      // when the wizard remains on the same product tuple. Do not advance
      // the generation here: callers may already be waiting on its token.
      hasCommittedRef.current = false;
      return true;
    }
    return false;
  }, [callbacks]);

  const startCleanup = useCallback(() => {
    const pending = pendingCleanupRef.current;
    if (pending) return pending;

    const cleanup = (async (): Promise<CleanupResult> => {
      const pendingSave = pendingSaveRef.current;
      if (pendingSave) await pendingSave.catch(() => false);

      const pendingDraft = pendingDraftRef.current;
      if (pendingDraft) {
        try {
          await pendingDraft;
        } catch {
          // A rejected draft create never committed a configuration.
        }
      }

      try {
        await removeCreatedConfiguration();
        return { success: true };
      } catch (cause) {
        return { success: false, cause };
      }
    })();
    pendingCleanupRef.current = cleanup;
    cleanup.then(
      () => {
        if (pendingCleanupRef.current === cleanup) pendingCleanupRef.current = null;
      },
      () => {
        if (pendingCleanupRef.current === cleanup) pendingCleanupRef.current = null;
      },
    );
    return cleanup;
  }, [removeCreatedConfiguration]);

  const cleanupCreatedConfiguration = async () => {
    const cleanup = startCleanup();
    const result = await cleanup;
    if (!result.success && reportedCleanupRef.current !== cleanup) {
      reportedCleanupRef.current = cleanup;
      onCleanupError?.(
        `${CLEANUP_ERROR_PREFIX}: ${getClientSafeError(
          result.cause,
          "Retry the explicit delete action.",
          wizardData,
        )}`,
      );
    }
  };

  const revokeCreatedConfigurationOnPageHide = () => {
    const created = createdConfigurationRef.current;
    if (!created) return;
    callbacks?.revokeConfigurationOnPageHide?.(created.configurationId, created.revision);
  };

  // Configuration-bound discovery may only address a record the server has
  // actually committed. The wizard therefore persists the draft tuple before
  // the model step reads it back, and revokes it again through the existing
  // cleanup paths when the tuple changes or setup is abandoned.
  const prepareDraftConfiguration = async (): Promise<ClientConfigurationSummary | null> => {
    if (!callbacks) return null;
    const data = wizardData;
    const prepared = preparedDraftRef.current;
    if (prepared && areConfigurationInputsEqual(prepared.input, data.configurationInput)) {
      return prepared.configuration;
    }
    const pending = pendingDraftRef.current;
    if (pending) return pending.catch(() => null);

    const generation = generationRef.current;
    setIsPreparingDraftConfiguration(true);
    preparedDraftRef.current = null;
    setPreparedDraft(null);

    const prepare = (async (): Promise<ClientConfigurationSummary> => {
      if (createdConfigurationRef.current) await removeCreatedConfiguration();
      const response = await runConfigurationAction(buildConfigPayload(data));
      if (
        response.action !== "create" ||
        response.status !== "succeeded" ||
        !response.configuration
      ) {
        throw new Error("Configuration create did not return a configuration");
      }
      return response.configuration;
    })();
    pendingDraftRef.current = prepare;

    try {
      const configuration = await prepare;
      if (generation !== generationRef.current) return null;
      const nextPrepared = { input: data.configurationInput, configuration };
      preparedDraftRef.current = nextPrepared;
      setPreparedDraft(nextPrepared);
      return configuration;
    } catch (cause) {
      if (generation === generationRef.current) {
        setWizardState((current) => ({
          ...current,
          error: `${DRAFT_CONFIGURATION_ERROR_PREFIX}: ${getClientSafeError(
            cause,
            "Retry model discovery.",
            data,
          )}`,
        }));
      }
      return null;
    } finally {
      if (pendingDraftRef.current === prepare) pendingDraftRef.current = null;
      setIsPreparingDraftConfiguration(false);
    }
  };

  const next = (partial?: OnboardingDraftUpdate) => {
    setWizardState((current) => {
      if (partial && !keepsProductTuple(current.data, partial)) {
        return { ...current, error: CROSS_PRODUCT_UPDATE_ERROR };
      }
      const step = current.data.plan.steps[current.stepIndex];
      if (!step) throw new RangeError(`No onboarding step at index ${current.stepIndex}`);
      const projectedData = partial ? updateRunnableDraft(current.data, partial) : current.data;
      if (
        !canProceed(step.id, projectedData) ||
        current.stepIndex === current.data.plan.steps.length - 1
      ) {
        return current;
      }
      ensureGenerationFor(projectedData);
      return { data: projectedData, stepIndex: current.stepIndex + 1, error: null };
    });
  };

  const back = () => {
    setWizardState((current) =>
      current.stepIndex === 0
        ? current
        : { ...current, stepIndex: current.stepIndex - 1, error: null },
    );
  };

  const updateData = (partial: OnboardingDraftUpdate) => {
    setWizardState((current) => {
      if (!keepsProductTuple(current.data, partial)) {
        return { ...current, error: CROSS_PRODUCT_UPDATE_ERROR };
      }
      const data = updateRunnableDraft(current.data, partial);
      if (areDraftsEqual(current.data, data)) return current;
      ensureGenerationFor(data);
      return { ...current, data };
    });
  };

  const setProduct = (productId: RunnableProductId) => {
    const previousRequestedProduct = requestedProductRef.current;
    requestedProductRef.current = productId;
    if (wizardData.plan.productId !== productId) {
      // Product selection is a commit-relevant change even while cleanup is
      // waiting for an in-flight save. Invalidate that save before its next
      // continuation can observe the old generation.
      generationRef.current += 1;
      hasCommittedRef.current = false;
    }
    if (
      wizardData.plan.productId === productId &&
      (previousRequestedProduct === null || previousRequestedProduct === productId)
    ) {
      return;
    }
    const reset = () => {
      setWizardState((current) => {
        const requestedProduct = requestedProductRef.current ?? productId;
        if (current.data.plan.productId === requestedProduct) return current;
        const data = resetWizardProduct(current.data, requestedProduct);
        ensureGenerationFor(data);
        return {
          data,
          stepIndex: 0,
          error: null,
        };
      });
    };
    if (!createdConfigurationRef.current && !pendingSaveRef.current && !pendingCleanupRef.current) {
      reset();
      return;
    }

    const reconciliation = ++reconciliationRef.current;
    setIsReconciling(true);
    startCleanup()
      .then((result) => {
        if (reconciliation !== reconciliationRef.current) return;
        if (requestedProductRef.current !== productId) return;
        if (result.success) {
          reset();
          return;
        }
        setWizardState((current) => ({
          ...current,
          error: `${CLEANUP_ERROR_PREFIX}: ${getClientSafeError(
            result.cause,
            "Retry deletion.",
            wizardData,
          )}`,
        }));
      })
      .finally(() => {
        if (reconciliation === reconciliationRef.current) setIsReconciling(false);
      });
  };

  const complete = async () => {
    if (!callbacks || pendingSaveRef.current || pendingCleanupRef.current) return false;
    const generation = generationRef.current;
    if (hasCommittedRef.current) {
      return finishCommittedOperation(generation);
    }
    setIsSubmitting(true);
    setWizardState((current) => ({ ...current, error: null }));

    const save = (async () => {
      // saveWizard owns the create for the final tuple. Revoke the discovery
      // draft first so the completed setup cannot orphan an extra record.
      if (createdConfigurationRef.current) await removeCreatedConfiguration();
      const result = await saveWizard(wizardData, {
        saveSettings: callbacks.saveSettings,
        runConfigurationAction,
      });
      if (result.status === "partial") {
        if (generation === generationRef.current) {
          setWizardState((current) => ({
            ...current,
            error: getClientSafeError(result.error, "Setup failed", wizardData),
          }));
        }
        return false;
      }
      if (generation !== generationRef.current) return false;
      hasCommittedRef.current = true;
      createdConfigurationRef.current = null;
      setWizardState((current) => {
        if (generation !== generationRef.current) return current;
        const data = scrubLiteralSecret(current.data);
        // The successful save intentionally removes write-only literals from
        // the in-memory draft. Keep the generation identity aligned with the
        // scrubbed representation without resetting the commit marker.
        generationDataRef.current = data;
        return { ...current, data };
      });
      return finishCommittedOperation(generation);
    })();
    pendingSaveRef.current = save;

    try {
      return await save;
    } catch (cause) {
      if (generation === generationRef.current) {
        setWizardState((current) => ({
          ...current,
          error: getClientSafeError(cause, "Setup failed", wizardData),
        }));
      }
      return false;
    } finally {
      if (pendingSaveRef.current === save) {
        pendingSaveRef.current = null;
        // A save may have created a partial configuration before the draft was
        // edited or replaced. Revoke that exact record before exposing the
        // stale completion to the caller; otherwise a later save could orphan
        // the old configuration or overwrite its cleanup marker.
        if (generation !== generationRef.current && createdConfigurationRef.current) {
          await cleanupCreatedConfiguration();
        }
      }
      setIsSubmitting(false);
    }
  };

  // A new initial draft is a new commit generation. The advance runs in a layout
  // effect so it lands synchronously with the commit, before an in-flight save
  // for the previous draft can resolve; a render React discards never reaches
  // the commit and so never invalidates a save that is still current.
  useLayoutEffect(() => {
    latestInitialRef.current = initial;
    if (areDraftsEqual(initialRef.current, initial)) return;

    initialRef.current = initial;
    requestedProductRef.current = null;
    ensureGenerationFor(initial);
    const generation = generationRef.current;
    startCleanup().then((result) => {
      if (generation !== generationRef.current) return;
      if (requestedProductRef.current !== null) return;
      if (!result.success) {
        setWizardState((current) => ({
          ...current,
          error: `${CLEANUP_ERROR_PREFIX}: ${getClientSafeError(
            result.cause,
            "Retry deletion.",
            initial,
          )}`,
        }));
        return;
      }
      setWizardState({ data: latestInitialRef.current, stepIndex: 0, error: null });
    });
  }, [initial, ensureGenerationFor, startCleanup]);

  const cleanupOnUnmount = useEffectEvent(() => {
    void cleanupCreatedConfiguration();
  });
  useEffect(() => () => cleanupOnUnmount(), []);

  return {
    wizardData,
    stepIndex,
    currentStep,
    steps,
    isFirstStep,
    isLastStep,
    canProceed: canProceedNow,
    isReconciling,
    isSubmitting,
    error,
    draftConfiguration: activeDraftConfiguration,
    isPreparingDraftConfiguration,
    prepareDraftConfiguration,
    next,
    back,
    updateData,
    setProduct,
    complete,
    cleanupCreatedConfiguration,
    revokeCreatedConfigurationOnPageHide,
  };
}
