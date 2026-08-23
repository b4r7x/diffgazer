import {
  AcceptedAcknowledgementSchema,
  acceptProviderConsent,
  type ClientConfigurationAction,
  type ClientConfigurationActionResponse,
  ClientConfigurationActionResponseSchema,
  ClientConfigurationInputSchema,
  type ClientConfigurationSummary,
  type ConfigurationId,
  type ConfigurationRevision,
  type ExactModelId,
  ExactModelIdSchema,
  type SettingsConfig,
} from "../schemas/config/index.js";
import { canProceed } from "./can-proceed.js";
import type { OnboardingDraft } from "./defaults.js";
import { getPlanNotice } from "./setup-plan.js";

type SettingsPayload = Pick<SettingsConfig, "defaultLenses" | "agentExecution" | "providerConsent">;

type CreateConfigurationAction = Extract<ClientConfigurationAction, { action: "create" }>;
type SelectConfigurationAction = Extract<ClientConfigurationAction, { action: "select" }>;
type UpdateConfigurationAction = Extract<ClientConfigurationAction, { action: "update" }>;

function assertExactModel(data: OnboardingDraft): ExactModelId {
  if (!canProceed("model", data)) {
    throw new Error(
      "Cannot select a model before the configured transport and exact model are ready",
    );
  }
  return ExactModelIdSchema.parse(data.selectedModelId);
}

function assertAcceptedNotice(data: OnboardingDraft) {
  const acknowledgement = AcceptedAcknowledgementSchema.parse(data.acknowledgement);
  const notice = getPlanNotice(data.plan);
  if (
    acknowledgement.noticeId !== notice.id ||
    acknowledgement.noticeVersion !== notice.noticeVersion
  ) {
    throw new Error("Cannot complete setup before the current product notice is accepted");
  }
  return acknowledgement;
}

/**
 * The wizard's consent step accepts the global provider consent and the selected
 * product's notice in one gesture; the settings write records the former at the
 * moment the draft recorded the latter.
 */
export function buildSettingsPayload(data: OnboardingDraft): SettingsPayload {
  return {
    defaultLenses: [...data.defaultLenses],
    agentExecution: data.agentExecution,
    providerConsent: acceptProviderConsent(assertAcceptedNotice(data).acceptedAt),
  };
}

export function buildConfigPayload(data: OnboardingDraft): CreateConfigurationAction {
  return {
    action: "create",
    input: ClientConfigurationInputSchema.parse(data.configurationInput),
  };
}

export function buildSelectPayload(
  data: OnboardingDraft,
  configurationId: ConfigurationId,
): SelectConfigurationAction {
  const exactModelId = assertExactModel(data);
  return {
    action: "select",
    configurationId,
    modelId: exactModelId,
  };
}

export function buildUpdatePayload(
  data: OnboardingDraft,
  configurationId: ConfigurationId,
  expectedRevision: number,
): UpdateConfigurationAction {
  return {
    action: "update",
    configurationId,
    expectedRevision,
    input: ClientConfigurationInputSchema.parse(data.configurationInput),
    acknowledgement: assertAcceptedNotice(data),
  };
}

export interface SaveWizardCallbacks {
  saveSettings: (payload: SettingsPayload) => Promise<unknown>;
  runConfigurationAction: (action: ClientConfigurationAction) => Promise<unknown>;
  /**
   * Fire-and-forget delete used when the page unloads. Must use a transport that
   * survives tab close, such as `fetch` with `keepalive: true`.
   */
  revokeConfigurationOnPageHide?: (
    configurationId: ConfigurationId,
    expectedRevision: ConfigurationRevision,
  ) => void;
}

type CompletedStep = "settings" | "configuration" | "model-selection";

export type SaveWizardResult =
  | { status: "complete"; configurationId: ConfigurationId }
  | { status: "partial"; completedSteps: CompletedStep[]; error: unknown };

function parseSucceededResponse<Action extends ClientConfigurationAction["action"]>(
  response: unknown,
  action: Action,
): Extract<ClientConfigurationActionResponse, { action: Action }> {
  const parsed = ClientConfigurationActionResponseSchema.parse(response);
  if (parsed.action !== action || parsed.status !== "succeeded") {
    throw new Error(`Configuration ${action} did not succeed`);
  }
  return parsed as Extract<ClientConfigurationActionResponse, { action: Action }>;
}

function arraysMatch(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function noticesMatch(
  expected: ClientConfigurationSummary["notices"],
  actual: ClientConfigurationSummary["notices"],
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((notice, index) => {
      const candidate = actual[index];
      return (
        candidate !== undefined &&
        candidate.id === notice.id &&
        candidate.noticeVersion === notice.noticeVersion &&
        candidate.acknowledgement === notice.acknowledgement &&
        candidate.acknowledgeBefore === notice.acknowledgeBefore &&
        candidate.renewAcknowledgementOn === notice.renewAcknowledgementOn &&
        arraysMatch(candidate.billing, notice.billing) &&
        arraysMatch(candidate.privacy, notice.privacy)
      );
    })
  );
}

function expectedNotices(data: OnboardingDraft): ClientConfigurationSummary["notices"] {
  const notice = getPlanNotice(data.plan);
  return [
    {
      id: notice.id,
      noticeVersion: notice.noticeVersion,
      acknowledgement: notice.acknowledgement,
      acknowledgeBefore: notice.acknowledgeBefore,
      renewAcknowledgementOn: notice.renewAcknowledgementOn,
      billing: [...notice.billing],
      privacy: [...notice.privacy],
    },
  ];
}

function matchesDraftTuple(
  data: OnboardingDraft,
  summary: ClientConfigurationSummary,
  selectedModelId: string | null,
): boolean {
  const input = ClientConfigurationInputSchema.parse(data.configurationInput);
  if (
    summary.productId !== input.productId ||
    summary.transportFamily !== input.transportFamily ||
    summary.selectedModelId !== selectedModelId ||
    !noticesMatch(expectedNotices(data), summary.notices)
  ) {
    return false;
  }

  if (summary.transportFamily === "hosted-api" && input.transportFamily === "hosted-api") {
    return (
      summary.endpoint === input.endpoint &&
      summary.region === input.region &&
      summary.workspace === input.workspace
    );
  }
  if (summary.transportFamily === "local-http" && input.transportFamily === "local-http") {
    return (
      summary.endpoint === input.endpoint &&
      summary.authentication === input.authentication &&
      summary.presetId === input.presetId
    );
  }
  return (
    summary.transportFamily === "local-cli" &&
    input.transportFamily === "local-cli" &&
    summary.installationId === input.installationId
  );
}

export async function saveWizard(
  data: OnboardingDraft,
  { saveSettings, runConfigurationAction }: SaveWizardCallbacks,
): Promise<SaveWizardResult> {
  const completedSteps: CompletedStep[] = [];

  try {
    await saveSettings(buildSettingsPayload(data));
    completedSteps.push("settings");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  let createdConfiguration: ClientConfigurationSummary;
  try {
    const createAction = buildConfigPayload(data);
    const response = parseSucceededResponse(
      await runConfigurationAction(createAction),
      createAction.action,
    );
    if (!response.configuration || !matchesDraftTuple(data, response.configuration, null)) {
      throw new Error("Configuration create did not return the exact provisional tuple");
    }
    createdConfiguration = response.configuration;
    completedSteps.push("configuration");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  const selectedModelId = data.selectedModelId;
  if (selectedModelId === null) {
    return {
      status: "partial",
      completedSteps,
      error: new Error("Cannot save configuration before an exact model is explicitly selected"),
    };
  }

  let selectedConfiguration: ClientConfigurationSummary;
  try {
    const selectAction = buildSelectPayload(data, createdConfiguration.configurationId);
    const response = parseSucceededResponse(
      await runConfigurationAction(selectAction),
      selectAction.action,
    );
    if (
      !response.configuration ||
      !matchesDraftTuple(data, response.configuration, selectedModelId)
    ) {
      throw new Error("Configuration select did not return the exact selected tuple");
    }
    selectedConfiguration = response.configuration;
    if (selectedConfiguration.revision < createdConfiguration.revision) {
      throw new Error("Configuration select returned an older revision");
    }
    completedSteps.push("model-selection");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  try {
    const updateAction = buildUpdatePayload(
      data,
      selectedConfiguration.configurationId,
      selectedConfiguration.revision,
    );
    const response = parseSucceededResponse(
      await runConfigurationAction(updateAction),
      updateAction.action,
    );
    if (
      !response.configuration ||
      !matchesDraftTuple(data, response.configuration, selectedModelId) ||
      response.configuration.revision < selectedConfiguration.revision
    ) {
      throw new Error("Configuration update did not return the exact acknowledged tuple");
    }
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  // Structured-output conformance is not a save-time prerequisite: the saved
  // configuration lands `conformance-pending`, and the first review proves or
  // disproves it inline without a paid probe here.
  return { status: "complete", configurationId: selectedConfiguration.configurationId };
}
