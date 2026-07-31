import {
  AcceptedAcknowledgementSchema,
  type ClientConfigurationAction,
  type ClientConfigurationActionResponse,
  ClientConfigurationActionResponseSchema,
  ClientConfigurationInputSchema,
  type ClientConfigurationSummary,
  type ConfigurationId,
  ExactModelIdSchema,
  type SettingsConfig,
} from "../schemas/config/index.js";
import { canProceed } from "./can-proceed.js";
import type { OnboardingDraft } from "./defaults.js";
import type { RemovedOnboardingState } from "./types.js";

export type SettingsPayload = Pick<SettingsConfig, "defaultLenses" | "agentExecution">;

export function buildSettingsPayload(data: OnboardingDraft): SettingsPayload {
  return {
    defaultLenses: [...data.defaultLenses],
    agentExecution: data.agentExecution,
  };
}

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;
type CreateConfigurationAction = Extract<ClientConfigurationAction, { action: "create" }>;
type SelectConfigurationAction = Extract<ClientConfigurationAction, { action: "select" }>;
type UpdateConfigurationAction = Extract<ClientConfigurationAction, { action: "update" }>;

function getNotice(data: OnboardingDraft) {
  const notice = data.plan.steps.find((step) => step.id === "acknowledgement")?.notice;
  if (!notice) throw new Error("The setup plan has no product notice");
  return notice;
}

function assertExactModel(data: OnboardingDraft, modelId = data.selectedModelId): string {
  const candidate = modelId === null ? data : { ...data, selectedModelId: modelId };
  if (!canProceed("model", candidate)) {
    throw new Error(
      "Cannot select a model before the configured transport and exact model are ready",
    );
  }
  return ExactModelIdSchema.parse(modelId);
}

function assertAcceptedNotice(data: OnboardingDraft) {
  const acknowledgement = AcceptedAcknowledgementSchema.parse(data.acknowledgement);
  const notice = getNotice(data);
  if (
    acknowledgement.noticeId !== notice.id ||
    acknowledgement.noticeVersion !== notice.noticeVersion
  ) {
    throw new Error("Cannot complete setup before the current product notice is accepted");
  }
  return acknowledgement;
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
  modelId = data.selectedModelId,
): SelectConfigurationAction {
  const exactModelId = assertExactModel(data, modelId);
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
}

type CompletedStep = "settings" | "configuration" | "model-selection" | "conformance";

export type SaveWizardResult =
  | { status: "complete"; configurationId: ConfigurationId }
  | { status: "preserved-removed"; configurationId: ConfigurationId }
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
  expected: SupportedConfigurationSummary["notices"],
  actual: SupportedConfigurationSummary["notices"],
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

function expectedNotices(data: OnboardingDraft): SupportedConfigurationSummary["notices"] {
  const notice = getNotice(data);
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
): summary is SupportedConfigurationSummary {
  const input = ClientConfigurationInputSchema.parse(data.configurationInput);
  if (
    summary.status !== "supported" ||
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

function summariesMatch(
  expected: SupportedConfigurationSummary,
  actual: ClientConfigurationSummary,
): actual is SupportedConfigurationSummary {
  if (
    actual.status !== "supported" ||
    actual.configurationId !== expected.configurationId ||
    actual.revision !== expected.revision ||
    actual.productId !== expected.productId ||
    actual.transportFamily !== expected.transportFamily ||
    actual.selectedModelId !== expected.selectedModelId ||
    !arraysMatch(actual.availableActions, expected.availableActions) ||
    !noticesMatch(expected.notices, actual.notices)
  ) {
    return false;
  }

  if (expected.transportFamily === "hosted-api") {
    return (
      actual.transportFamily === "hosted-api" &&
      actual.endpoint === expected.endpoint &&
      actual.region === expected.region &&
      actual.workspace === expected.workspace
    );
  }
  if (expected.transportFamily === "local-http") {
    return (
      actual.transportFamily === "local-http" &&
      actual.endpoint === expected.endpoint &&
      actual.authentication === expected.authentication &&
      actual.presetId === expected.presetId
    );
  }
  return (
    actual.transportFamily === "local-cli" && actual.installationId === expected.installationId
  );
}

function assertDiscoveryEvidence(
  data: OnboardingDraft,
  created: SupportedConfigurationSummary,
  response: Extract<ClientConfigurationActionResponse, { action: "test" }>,
): SupportedConfigurationSummary {
  const discovered = response.configuration;
  // A test action is discovery/conformance only. It must not mutate the
  // persisted selected model; that happens only through the explicit select
  // action below. Require the provisional summary shape here so a server
  // cannot smuggle a discovered model into the save flow.
  if (!discovered || !matchesDraftTuple(data, discovered, null)) {
    throw new Error("Configuration discovery returned a different product tuple");
  }
  if (
    discovered.configurationId !== created.configurationId ||
    discovered.revision < created.revision
  ) {
    throw new Error("Configuration discovery did not return the created configuration");
  }
  if (response.readiness.evidenceStatus !== "passed" || response.readiness.checkedAt === null) {
    throw new Error("Configuration discovery did not produce checked evidence");
  }
  return discovered;
}

export async function saveWizard(
  data: OnboardingDraft | RemovedOnboardingState,
  { saveSettings, runConfigurationAction }: SaveWizardCallbacks,
): Promise<SaveWizardResult> {
  if (data.kind === "removed") {
    return { status: "preserved-removed", configurationId: data.configurationId };
  }

  const completedSteps: CompletedStep[] = [];

  try {
    await saveSettings(buildSettingsPayload(data));
    completedSteps.push("settings");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  let createdConfiguration: SupportedConfigurationSummary;
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

  let discoveredConfiguration: SupportedConfigurationSummary;
  try {
    const discoveryAction = {
      action: "test",
      configurationId: createdConfiguration.configurationId,
    } as const;
    const response = parseSucceededResponse(
      await runConfigurationAction(discoveryAction),
      discoveryAction.action,
    );
    discoveredConfiguration = assertDiscoveryEvidence(data, createdConfiguration, response);
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  // Discovery is intentionally non-selecting. The model must already be an
  // explicit client choice before save can continue to select/update/test it.
  const selectedModelId = data.selectedModelId;
  if (selectedModelId === null) {
    return {
      status: "partial",
      completedSteps,
      error: new Error("Cannot save configuration before an exact model is explicitly selected"),
    };
  }

  let selectedConfiguration: SupportedConfigurationSummary;
  try {
    const selectAction = buildSelectPayload(
      data,
      createdConfiguration.configurationId,
      selectedModelId,
    );
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
    if (selectedConfiguration.revision < discoveredConfiguration.revision) {
      throw new Error("Configuration select returned an older revision");
    }
    completedSteps.push("model-selection");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  let acknowledgedConfiguration: SupportedConfigurationSummary;
  try {
    const updateAction = buildUpdatePayload(
      { ...data, selectedModelId },
      selectedConfiguration.configurationId,
      selectedConfiguration.revision,
    );
    const response = parseSucceededResponse(
      await runConfigurationAction(updateAction),
      updateAction.action,
    );
    if (
      !response.configuration ||
      !matchesDraftTuple({ ...data, selectedModelId }, response.configuration, selectedModelId) ||
      response.configuration.revision < selectedConfiguration.revision
    ) {
      throw new Error("Configuration update did not return the exact acknowledged tuple");
    }
    acknowledgedConfiguration = response.configuration;
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  try {
    const testAction = {
      action: "test",
      configurationId: acknowledgedConfiguration.configurationId,
    } as const;
    const response = parseSucceededResponse(
      await runConfigurationAction(testAction),
      testAction.action,
    );
    if (
      !response.configuration ||
      !summariesMatch(acknowledgedConfiguration, response.configuration)
    ) {
      throw new Error("Configuration test response did not match the selected tuple");
    }
    const acknowledgement = assertAcceptedNotice(data);
    if (
      response.readiness.status !== "ready" ||
      !response.readiness.ready ||
      response.readiness.evidenceStatus !== "passed" ||
      response.readiness.acknowledgement.status !== "accepted" ||
      response.readiness.acknowledgement.noticeId !== acknowledgement.noticeId ||
      response.readiness.acknowledgement.noticeVersion !== acknowledgement.noticeVersion
    ) {
      throw new Error("Configuration test did not produce current readiness evidence");
    }
    completedSteps.push("conformance");
  } catch (error) {
    return { status: "partial", completedSteps, error };
  }

  return { status: "complete", configurationId: selectedConfiguration.configurationId };
}
