import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { sanitizeTerminalText } from "../review/sanitize-terminal.js";
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
import { buildConfigPayload, type SaveWizardCallbacks, saveWizard } from "./save-wizard.js";
import { getStepAt } from "./steps.js";
import type { OnboardingStep, RemovedOnboardingState } from "./types.js";

const CLEANUP_ERROR_PREFIX = "Failed to remove the incomplete configuration";
const DRAFT_CONFIGURATION_ERROR_PREFIX = "Could not prepare this configuration for model discovery";
const SAVE_COMPLETION_ERROR_PREFIX = "Configuration saved, but completion failed";
const DELETE_COMPLETION_ERROR_PREFIX = "Configuration deleted, but completion failed";
const CLIENT_ERROR_MAX_BYTES = 512;
const REDACTED = "[REDACTED]";

const PATH_BOUNDARY = String.raw`(^|[\s("'=<{[,:;])`;
const PATH_CHARACTER = "[^\\\\/\\s\"'`<>{},;)]|[ \\t](?=[^\\\\/\\s\"'`<>{},;)])";

const UNIX_PATH_PATTERN = new RegExp(
  `${PATH_BOUNDARY}((?:~|\\/(?:Users|home|private\\/var\\/folders|var\\/folders|tmp|usr|bin|srv|opt|etc))(?:\\/[^\\s"'\`<>{},;)]*)*)`,
  "gi",
);
const WINDOWS_PATH_PATTERN = new RegExp(
  `${PATH_BOUNDARY}([A-Za-z]:[\\\\/](?:${PATH_CHARACTER})+(?:[\\\\/](?:${PATH_CHARACTER})+)*)`,
  "gi",
);
const UNC_PATH_PATTERN = new RegExp(
  `${PATH_BOUNDARY}(\\\\\\\\(?:${PATH_CHARACTER})+[\\\\/](?:${PATH_CHARACTER})+(?:[\\\\/](?:${PATH_CHARACTER})+)*)`,
  "gi",
);
const RELATIVE_PATH_PATTERN =
  /(^|[\s("'=<{[])((?:\.{1,2}[\\/]|(?:[A-Za-z0-9._-]+[\\/])+)[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)*)/g;
const AUTH_HEADER_PATTERN =
  /\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\s,;]+/gi;
const BEARER_PATTERN = /\b(?:bearer|basic)\s+[A-Za-z0-9._~+\x2f-]{8,}=*/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api(?:[-_ ]?key)|access[-_ ]?token|auth(?:orization)?|credential|password|passwd|secret|token|private[-_ ]?key|client[-_ ]?secret)\b\s*(?:[:=]|\bis\b)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const SECRET_FLAG_PATTERN =
  /--?(?:api(?:[-_ ]?key)|auth(?:orization)?|bearer|cookie|credential|password|secret|token)\s+(?:["'`][^"'`]+["'`]|[^\s]+)/gi;
const ENV_SECRET_PATTERN =
  /\b[A-Z][A-Z0-9]*(?:[_-](?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE))\b\s*=\s*[^\s,;]+/g;
const TOKEN_PATTERN =
  /\b(?:sk|pk|rk|ghp|github_pat|AIza|ya29|xox[baprs]-)[A-Za-z0-9._~+\x2f-]{8,}=*/gi;
const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi;
const UNTRUSTED_PROVIDER_ERROR_PATTERN =
  /\b(?:provider|upstream|model|endpoint|network|http|https|request|response|redirect|authorization|credential|token|secret|api[-_ ]?key|bearer|cookie|quota|rate[-_ ]?limit|timeout|timed? ?out|abort(?:ed)?|cancel(?:led)?|subprocess|command|exec(?:utable)?|stdout|stderr|parser|parse|json|schema|transport|dns|socket|econn|status\s*(?:code)?|cli)\b/i;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (utf8ByteLength(value) <= maxBytes) return value;

  let output = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    output += character;
    bytes += characterBytes;
  }
  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactPathMatch(_match: string, prefix: string, path: string): string {
  const trailingPunctuation = path.match(/[.!?]+$/)?.[0] ?? "";
  return `${prefix}${REDACTED}${trailingPunctuation}`;
}

function redactPaths(value: string): string {
  return value
    .replace(UNIX_PATH_PATTERN, redactPathMatch)
    .replace(WINDOWS_PATH_PATTERN, redactPathMatch)
    .replace(UNC_PATH_PATTERN, redactPathMatch)
    .replace(RELATIVE_PATH_PATTERN, redactPathMatch);
}

function redactClientError(value: string, sensitiveValues: readonly string[]): string {
  let redacted = value;
  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue.length === 0) continue;
    redacted = redacted.replace(new RegExp(escapeRegExp(sensitiveValue), "g"), REDACTED);
  }

  redacted = redactPaths(
    redacted
      .replace(PRIVATE_KEY_PATTERN, REDACTED)
      .replace(AUTH_HEADER_PATTERN, REDACTED)
      .replace(BEARER_PATTERN, REDACTED)
      .replace(SECRET_ASSIGNMENT_PATTERN, REDACTED)
      .replace(SECRET_FLAG_PATTERN, REDACTED)
      .replace(ENV_SECRET_PATTERN, REDACTED)
      .replace(TOKEN_PATTERN, REDACTED),
  ).replace(/\n/g, " ");

  return sanitizeTerminalText(redacted)
    .replace(/[ \t\n]+/g, " ")
    .trim();
}

function getWizardSensitiveValues(data: WizardData | undefined): readonly string[] {
  if (!data || data.kind !== "runnable") return [];

  const values: string[] = [];
  const input = data.configurationInput;
  if (input.transportFamily === "hosted-api") {
    if (input.credential?.kind === "literal") values.push(input.credential.value);
    if (input.workspace) values.push(input.workspace);
  }
  if (input.transportFamily === "local-http" && input.bearerToken?.kind === "literal") {
    values.push(input.bearerToken.value);
  }
  return values;
}

function getClientSafeError(cause: unknown, fallback: string, data?: WizardData): string {
  if (!(cause instanceof Error) || cause.message.trim().length === 0) return fallback;

  const rawMessage = cause.message;
  // Provider, CLI, subprocess, and transport errors are not an API for the
  // client. Their details are useful to server diagnostics, but never safe to
  // echo into the wizard, even after redaction. Keep the user-facing copy
  // actionable without exposing an unknown parser/adapter envelope.
  if (UNTRUSTED_PROVIDER_ERROR_PATTERN.test(rawMessage)) return fallback;

  const redacted = redactClientError(rawMessage, getWizardSensitiveValues(data));
  if (redacted.length === 0) return fallback;
  return truncateUtf8(redacted, CLIENT_ERROR_MAX_BYTES);
}

export type WizardSaveCallbacks = SaveWizardCallbacks;

export interface UseWizardStateOptions {
  initial?: OnboardingDraft | RemovedOnboardingState;
  callbacks?: WizardSaveCallbacks;
  onComplete?: () => Promise<void> | void;
  onCleanupError?: (message: string) => void;
}

export interface UseWizardStateResult {
  wizardData: WizardData;
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
  draftConfiguration: SupportedConfigurationSummary | null;
  isPreparingDraftConfiguration: boolean;
  prepareDraftConfiguration: () => Promise<SupportedConfigurationSummary | null>;
  next: (partial?: OnboardingDraftUpdate) => void;
  back: () => void;
  updateData: (partial: OnboardingDraftUpdate) => void;
  setProduct: (productId: RunnableProductId) => void;
  complete: () => Promise<boolean>;
  deleteRemovedConfiguration: () => Promise<boolean>;
  cleanupCreatedConfiguration: () => Promise<void>;
}

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;
type CreatedConfiguration = Pick<ClientConfigurationSummary, "configurationId" | "revision">;
type OnboardingDraftUpdate = Partial<Omit<OnboardingDraft, "kind" | "plan">>;
type WizardData = OnboardingDraft | RemovedOnboardingState;
type WriteOnlySecret =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "environment" };

type CleanupResult =
  | { readonly success: true }
  | { readonly success: false; readonly cause: unknown };

interface WizardState {
  readonly data: WizardData;
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

function areSecretsEqual(
  left: WriteOnlySecret | undefined,
  right: WriteOnlySecret | undefined,
): boolean {
  if (left?.kind !== right?.kind) return false;
  if (left?.kind !== "literal" || right?.kind !== "literal") return true;
  return left.value === right.value;
}

function areConfigurationInputsEqual(
  left: OnboardingConfigurationDraft,
  right: OnboardingConfigurationDraft,
): boolean {
  if (left.transportFamily !== right.transportFamily || left.productId !== right.productId) {
    return false;
  }

  if (left.transportFamily === "hosted-api" && right.transportFamily === "hosted-api") {
    return (
      left.endpoint === right.endpoint &&
      left.region === right.region &&
      left.workspace === right.workspace &&
      areSecretsEqual(left.credential, right.credential)
    );
  }

  if (left.transportFamily === "local-http" && right.transportFamily === "local-http") {
    return (
      left.endpoint === right.endpoint &&
      left.authentication === right.authentication &&
      left.presetId === right.presetId &&
      areSecretsEqual(left.bearerToken, right.bearerToken)
    );
  }

  if (left.transportFamily === "local-cli" && right.transportFamily === "local-cli") {
    return left.installationId === right.installationId;
  }

  return false;
}

function isSameConfigurationGeneration(left: OnboardingDraft, right: OnboardingDraft): boolean {
  return (
    left.plan.productId === right.plan.productId &&
    left.selectedModelId === right.selectedModelId &&
    areConfigurationInputsEqual(left.configurationInput, right.configurationInput)
  );
}

function isSameWizardGeneration(left: WizardData, right: WizardData): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "removed" && right.kind === "removed") {
    return (
      left.productId === right.productId &&
      left.configurationId === right.configurationId &&
      left.expectedRevision === right.expectedRevision
    );
  }
  if (left.kind === "runnable" && right.kind === "runnable") {
    return areDraftsEqual(left, right);
  }
  return false;
}

function areAcknowledgementsEqual(
  left: OnboardingDraft["acknowledgement"],
  right: OnboardingDraft["acknowledgement"],
): boolean {
  if (left.status !== right.status) return false;
  if (left.status === "required" && right.status === "required") return true;
  return (
    left.status === "accepted" &&
    right.status === "accepted" &&
    left.noticeId === right.noticeId &&
    left.noticeVersion === right.noticeVersion &&
    left.acceptedAt === right.acceptedAt
  );
}

function areDraftsEqual(left: OnboardingDraft, right: OnboardingDraft): boolean {
  return (
    isSameConfigurationGeneration(left, right) &&
    left.conformanceStatus === right.conformanceStatus &&
    areAcknowledgementsEqual(left.acknowledgement, right.acknowledgement) &&
    left.agentExecution === right.agentExecution &&
    left.defaultLenses.length === right.defaultLenses.length &&
    left.defaultLenses.every((lens, index) => lens === right.defaultLenses[index])
  );
}

function updateRunnableDraft(
  current: OnboardingDraft,
  partial: OnboardingDraftUpdate,
): OnboardingDraft {
  const next = { ...current, ...partial };
  if (!invalidatesAcknowledgement(current, partial)) return next;

  return {
    ...next,
    ...(partial.configurationInput || partial.selectedModelId !== undefined
      ? { conformanceStatus: "not-tested" as const }
      : {}),
    acknowledgement: { status: "required" },
  };
}

function canCurrentStepProceed(data: WizardData, stepIndex: number): boolean {
  if (data.kind === "removed") return getStepAt(data.plan, stepIndex) === "migration";

  const step = data.plan.steps[stepIndex];
  if (!step) throw new RangeError(`No onboarding step at index ${stepIndex}`);
  return canProceed(step.id, data);
}

function scrubLiteralSecret(data: OnboardingDraft): OnboardingDraft {
  const configurationInput = { ...data.configurationInput };
  if (
    configurationInput.transportFamily === "hosted-api" &&
    configurationInput.credential?.kind === "literal"
  ) {
    delete configurationInput.credential;
  }
  if (
    configurationInput.transportFamily === "local-http" &&
    configurationInput.bearerToken?.kind === "literal"
  ) {
    delete configurationInput.bearerToken;
  }
  return { ...data, configurationInput };
}

export function useWizardState(options: UseWizardStateOptions = {}): UseWizardStateResult {
  const { initial = getInitialWizardData(), callbacks, onComplete, onCleanupError } = options;
  const [wizardState, setWizardState] = useState<WizardState>(() => ({
    data: initial,
    stepIndex: 0,
    error: null,
  }));
  const [isReconciling, setIsReconciling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftConfiguration, setDraftConfiguration] =
    useState<SupportedConfigurationSummary | null>(null);
  const [isPreparingDraftConfiguration, setIsPreparingDraftConfiguration] = useState(false);
  const createdConfigurationRef = useRef<CreatedConfiguration | null>(null);
  // The ref pair is the authority for the async guard; the state copy only
  // drives rendering and would be stale inside back-to-back prepare calls.
  const draftInputRef = useRef<OnboardingConfigurationDraft | null>(null);
  const draftConfigurationRef = useRef<SupportedConfigurationSummary | null>(null);
  const pendingDraftRef = useRef<Promise<SupportedConfigurationSummary> | null>(null);
  const pendingSaveRef = useRef<Promise<boolean> | null>(null);
  const pendingRemovedDeleteRef = useRef<Promise<boolean> | null>(null);
  const pendingCleanupRef = useRef<Promise<CleanupResult> | null>(null);
  const reportedCleanupRef = useRef<Promise<CleanupResult> | null>(null);
  const hasCommittedRef = useRef(false);
  const generationRef = useRef(0);
  const generationDataRef = useRef<WizardData>(initial);
  const initialRef = useRef<WizardData>(initial);
  const latestInitialRef = useRef<WizardData>(initial);
  const requestedProductRef = useRef<RunnableProductId | null>(null);
  const reconciliationRef = useRef(0);
  latestInitialRef.current = initial;

  const { data: wizardData, stepIndex, error } = wizardState;
  const steps = wizardData.plan.steps.map((step) => step.id);
  const currentStep = getStepAt(wizardData.plan, stepIndex);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const canProceedNow = canCurrentStepProceed(wizardData, stepIndex);
  // A persisted draft is only addressable while it still describes the edited
  // transport tuple. Model selection alone must not invalidate it.
  const draftInput = draftInputRef.current;
  const activeDraftConfiguration =
    wizardData.kind === "runnable" &&
    draftInput !== null &&
    areConfigurationInputsEqual(draftInput, wizardData.configurationInput)
      ? draftConfiguration
      : null;

  // A new initial draft is a new commit generation as soon as it is rendered.
  // The effect below still performs cleanup and installs the draft, but the
  // synchronous token advance prevents an in-flight save for the previous
  // draft from committing in the gap before effects run.
  if (!isSameWizardGeneration(initialRef.current, initial)) {
    generationDataRef.current = initial;
    generationRef.current += 1;
    hasCommittedRef.current = false;
  }

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

  const ensureGenerationFor = useCallback((data: WizardData) => {
    if (isSameWizardGeneration(generationDataRef.current, data)) return;
    generationDataRef.current = data;
    generationRef.current += 1;
    hasCommittedRef.current = false;
  }, []);

  const finishCommittedOperation = async (errorPrefix: string, generation: number) => {
    if (generation !== generationRef.current) return false;
    setWizardState((current) => ({ ...current, error: null }));
    try {
      await onComplete?.();
    } catch (cause) {
      if (generation !== generationRef.current) return false;
      setWizardState((current) => ({
        ...current,
        error: `${errorPrefix}: ${getClientSafeError(cause, "Retry completion.", wizardData)}`,
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
      draftInputRef.current = null;
      draftConfigurationRef.current = null;
      setDraftConfiguration(null);
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

  // Configuration-bound discovery may only address a record the server has
  // actually committed. The wizard therefore persists the draft tuple before
  // the model step reads it back, and revokes it again through the existing
  // cleanup paths when the tuple changes or setup is abandoned.
  const prepareDraftConfiguration = async (): Promise<SupportedConfigurationSummary | null> => {
    if (!callbacks || wizardData.kind !== "runnable") return null;
    const data = wizardData;
    const preparedInput = draftInputRef.current;
    const prepared = draftConfigurationRef.current;
    if (
      prepared &&
      preparedInput &&
      areConfigurationInputsEqual(preparedInput, data.configurationInput)
    ) {
      return prepared;
    }
    const pending = pendingDraftRef.current;
    if (pending) return pending.catch(() => null);

    const generation = generationRef.current;
    setIsPreparingDraftConfiguration(true);
    draftConfigurationRef.current = null;
    setDraftConfiguration(null);

    const prepare = (async (): Promise<SupportedConfigurationSummary> => {
      if (createdConfigurationRef.current) await removeCreatedConfiguration();
      const response = await runConfigurationAction(buildConfigPayload(data));
      if (
        response.action !== "create" ||
        response.status !== "succeeded" ||
        response.configuration?.status !== "supported"
      ) {
        throw new Error("Configuration create did not return a supported configuration");
      }
      return response.configuration;
    })();
    pendingDraftRef.current = prepare;

    try {
      const configuration = await prepare;
      if (generation !== generationRef.current) return null;
      draftInputRef.current = data.configurationInput;
      draftConfigurationRef.current = configuration;
      setDraftConfiguration(configuration);
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
      if (current.data.kind === "removed") {
        const step = getStepAt(current.data.plan, current.stepIndex);
        if (step !== "migration") return current;
        return { ...current, stepIndex: current.stepIndex + 1, error: null };
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
    setWizardState((current) =>
      current.data.kind === "removed"
        ? current
        : (() => {
            const data = updateRunnableDraft(current.data, partial);
            if (areDraftsEqual(current.data, data)) return current;
            ensureGenerationFor(data);
            return { ...current, data };
          })(),
    );
  };

  const setProduct = (productId: RunnableProductId) => {
    const previousRequestedProduct = requestedProductRef.current;
    requestedProductRef.current = productId;
    if (wizardData.kind === "runnable" && wizardData.plan.productId !== productId) {
      // Product selection is a commit-relevant change even while cleanup is
      // waiting for an in-flight save. Invalidate that save before its next
      // continuation can observe the old generation.
      generationRef.current += 1;
      hasCommittedRef.current = false;
    }
    if (
      wizardData.kind === "runnable" &&
      wizardData.plan.productId === productId &&
      (previousRequestedProduct === null || previousRequestedProduct === productId)
    ) {
      return;
    }
    const reset = () => {
      setWizardState((current) => {
        const requestedProduct = requestedProductRef.current ?? productId;
        if (current.data.kind === "removed" || current.data.plan.productId === requestedProduct) {
          return current;
        }
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
    if (wizardData.kind === "removed") return;

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
    if (
      !callbacks ||
      wizardData.kind === "removed" ||
      pendingSaveRef.current ||
      pendingCleanupRef.current ||
      pendingRemovedDeleteRef.current
    ) {
      return false;
    }
    const generation = generationRef.current;
    if (hasCommittedRef.current) {
      return finishCommittedOperation(SAVE_COMPLETION_ERROR_PREFIX, generation);
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
        if (current.data.kind !== "runnable") return current;
        const data = scrubLiteralSecret(current.data);
        // The successful save intentionally removes write-only literals from
        // the in-memory draft. Keep the generation identity aligned with the
        // scrubbed representation without resetting the commit marker.
        generationDataRef.current = data;
        return { ...current, data };
      });
      return finishCommittedOperation(SAVE_COMPLETION_ERROR_PREFIX, generation);
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

  const deleteRemovedConfiguration = async () => {
    if (
      !callbacks ||
      wizardData.kind !== "removed" ||
      pendingRemovedDeleteRef.current ||
      pendingCleanupRef.current
    ) {
      return false;
    }
    const generation = generationRef.current;
    if (hasCommittedRef.current) {
      return finishCommittedOperation(DELETE_COMPLETION_ERROR_PREFIX, generation);
    }
    setIsSubmitting(true);
    setWizardState((current) => ({ ...current, error: null }));
    const action = {
      action: "delete",
      configurationId: wizardData.configurationId,
      expectedRevision: wizardData.expectedRevision,
    } as const;

    const deletion = (async () => {
      try {
        const response = ClientConfigurationActionResponseSchema.parse(
          await callbacks.runConfigurationAction(action),
        );
        if (response.action !== "delete" || response.status !== "succeeded") {
          throw new Error("Configuration delete did not succeed");
        }
        if (generation !== generationRef.current) return true;
        hasCommittedRef.current = true;
        return finishCommittedOperation(DELETE_COMPLETION_ERROR_PREFIX, generation);
      } catch (cause) {
        // A rejection that arrives after the wizard moved on belongs to a
        // superseded generation; writing it would overwrite the replacement
        // state with a stale failure.
        if (generation !== generationRef.current) return false;
        setWizardState((current) => ({
          ...current,
          error: getClientSafeError(cause, "Delete failed", wizardData),
        }));
        return false;
      }
    })();
    pendingRemovedDeleteRef.current = deletion;

    try {
      return await deletion;
    } finally {
      if (pendingRemovedDeleteRef.current === deletion) pendingRemovedDeleteRef.current = null;
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSameWizardGeneration(initialRef.current, initial)) return;

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
    deleteRemovedConfiguration,
    cleanupCreatedConfiguration,
  };
}
