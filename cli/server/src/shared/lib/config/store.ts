import { ok, type Result } from "@diffgazer/core/result";
import type {
  ClientConfigurationAction,
  ClientConfigurationActionResponse,
  ConfigurationId,
  ProjectInfo,
  SettingsConfig,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import type { AdmissionEvidence } from "./admission-evidence.js";
import { parseSettingsRecord } from "./persistence/config.js";
import type { ConfigurationBudgetLimits } from "./provider-config.js";
import { createConfigurationActions } from "./store/actions.js";
import { type CurrentDocumentState, createDocumentStore } from "./store/document-store.js";
import { createProjectStore } from "./store/projects.js";
import type { ConfigurationSnapshot } from "./store/snapshot.js";
import { createTrustStore } from "./trust-store.js";
import type { ConfigurationActionError, SecretsStorageError } from "./types.js";

export { budgetForSelectedModel, budgetWithinModelObservation } from "./budget-ceiling.js";

/** The budget every configuration is created with, and the limits admission projects from it. */
export const DEFAULT_CONFIGURATION_BUDGET: ConfigurationBudgetLimits = {
  inputTokens: 200_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  // One retry so the profiles that declare a malformed-output retry can take it;
  // profiles that do not stay at exactly one attempt.
  retries: 1,
  concurrency: 1,
  perReview: 5,
};

export interface ConfigStore {
  ready(): Promise<Result<void, ConfigurationActionError>>;
  readConfigurationSnapshot(): Promise<Result<ConfigurationSnapshot, ConfigurationActionError>>;
  readCurrentState(): Promise<Result<CurrentDocumentState, ConfigurationActionError>>;
  readSettings(): Promise<Result<SettingsConfig, ConfigurationActionError>>;
  updateSettings(
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, ConfigurationActionError>>;
  getProjectInfo(projectRoot?: string): ProjectInfo;
  getProjectInfoForResolvedRoot(projectRoot: string): ProjectInfo;
  ensureProjectFile(projectRoot: string): ProjectInfo;
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
  runConfigurationAction(
    action: ClientConfigurationAction,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>>;
  recordConfigurationEvidence(
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ): Promise<Result<boolean, ConfigurationActionError>>;
}

export function createConfigStore(): ConfigStore {
  const trustStore = createTrustStore();
  const documents = createDocumentStore({ budget: DEFAULT_CONFIGURATION_BUDGET });
  const actions = createConfigurationActions(documents, DEFAULT_CONFIGURATION_BUDGET);
  const projectStore = createProjectStore({ trustStore });
  const readSettings = async (): Promise<Result<SettingsConfig, ConfigurationActionError>> => {
    const current = await documents.readCurrentState();
    return current.ok ? ok(parseSettingsRecord(current.value.config.settings).settings) : current;
  };

  return {
    ready: documents.ready,
    readCurrentState: documents.readCurrentState,
    readSettings,
    ...actions,
    ...projectStore,
    getTrust: trustStore.getTrust,
    listTrustedProjects: trustStore.listTrustedProjects,
    saveTrust: trustStore.saveTrust,
    removeTrust: trustStore.removeTrust,
  };
}

let _store: ConfigStore | null = null;

export function getStore(): ConfigStore {
  if (!_store) _store = createConfigStore();
  return _store;
}
