import { CREDENTIAL_ENV_VARS } from "@diffgazer/core/providers";
import { err, type Result } from "@diffgazer/core/result";
import {
  type ClientConfigurationAction,
  type ClientConfigurationActionResponse,
  ClientConfigurationActionSchema,
  type ConfigurationId,
  type ConfigurationRevision,
  type Readiness,
  type ReadinessAcknowledgement,
  type RunnableProductId,
  type SettingsConfig,
} from "@diffgazer/core/schemas/config";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../../ai/admission/protocol.js";
import type { AdmissionEvidence } from "../admission-evidence.js";
import { parseSettingsRecord } from "../persistence/config.js";
import { literalCredentialFilePath } from "../persistence/credential-file-path.js";
import { findSecretBinding } from "../persistence/secrets.js";
import type {
  ConfigurationBudgetLimits,
  DecodedProviderConfigurationRecord,
  ProviderConfigurationRecord,
} from "../provider-config.js";
import { buildReadiness, computeProviderReadinessResult } from "../readiness.js";
import type { SecretBinding } from "../secret-bindings.js";
import { secretIO } from "../secret-io.js";
import { getConfigurationSecretName } from "../secrets-store.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";
import { createConformanceActions } from "./conformance-actions.js";
import {
  createCredentialLifecycle,
  credentialReferenceIdentityFor,
} from "./credential-lifecycle.js";
import { createCrudActions } from "./crud-actions.js";
import type { DocumentStore } from "./document-store.js";
import { summaryForSupportedRecord } from "./projection.js";
import type { ConfigurationSnapshot } from "./snapshot.js";
import { createSnapshotSettingsActions } from "./snapshot-settings-actions.js";

type ConfigurationActions = Readonly<{
  updateSettings: (
    patch: Partial<SettingsConfig>,
  ) => Promise<Result<SettingsConfig, ConfigurationActionError>>;
  readConfigurationSnapshot: () => Promise<Result<ConfigurationSnapshot, ConfigurationActionError>>;
  runConfigurationAction: (
    action: ClientConfigurationAction,
  ) => Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>>;
  recordConfigurationEvidence: (
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ) => Promise<Result<boolean, ConfigurationActionError>>;
}>;

export function createConfigurationActions(
  documents: DocumentStore,
  defaultBudget: ConfigurationBudgetLimits,
) {
  const getSettings = (): SettingsConfig =>
    parseSettingsRecord(documents.getConfigDocument().settings).settings;
  const secretsStorage = () => getSettings().secretsStorage ?? "file";

  const credentialLifecycle = createCredentialLifecycle({
    secretIO,
    getStorage: secretsStorage,
    literalSecretPath: literalCredentialFilePath,
    keyringSecretName: getConfigurationSecretName,
    encodeBytes: documents.encodeJsonBytes,
    canonicalEnv: (productId) => CREDENTIAL_ENV_VARS[productId as RunnableProductId] ?? null,
  });

  const findRecord = (
    configurationId: ConfigurationId,
  ): DecodedProviderConfigurationRecord | undefined =>
    documents
      .getConfigDocument()
      .configurations.find((record) =>
        record.status === "unknown"
          ? record.configurationId === configurationId
          : record.record.configurationId === configurationId,
      );

  const findBindingForIdentity = (
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
  ): SecretBinding | null =>
    findSecretBinding(documents.getSecretsDocument(), configurationId, revision);

  const readinessFor = (configuration: ProviderConfigurationRecord | null): Readiness => {
    if (!configuration) return computeProviderReadinessResult({ configuration: null }).readiness;
    if (configuration.status !== "supported") {
      return computeProviderReadinessResult({ configuration }).readiness;
    }
    const binding = findBindingForIdentity(configuration.configurationId, configuration.revision);
    const evidence = documents.getEvidence(configuration.configurationId);
    return computeProviderReadinessResult({
      configuration,
      binding,
      evidence,
      runtime: RUNTIME_IDENTITY,
      structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
      credentialReferenceIdentity: binding ? credentialReferenceIdentityFor(binding) : null,
    }).readiness;
  };

  const skippedReadiness = (): Readiness =>
    buildReadiness("skipped", new Date().toISOString(), "skipped", {
      status: "not-applicable",
    });

  const conformanceFailedReadiness = (acknowledgement: ReadinessAcknowledgement): Readiness =>
    buildReadiness("conformance-failed", new Date().toISOString(), "failed", acknowledgement);

  const crud = createCrudActions({
    documents,
    defaultBudget,
    findRecord,
    findBindingForIdentity,
    readinessFor,
    projectSummary: summaryForSupportedRecord,
    bindActionSecret: credentialLifecycle.bindActionSecret,
    discardBindingSecret: credentialLifecycle.discardBindingSecret,
    encodeDecodedBinding: credentialLifecycle.encodeDecodedBinding,
    tombstonesForRetiredBindings: credentialLifecycle.tombstonesForRetiredBindings,
    deleteRetiredSecretMaterial: credentialLifecycle.deleteRetiredSecretMaterial,
  });

  const conformance = createConformanceActions({
    documents,
    findRecord,
    findBindingForIdentity,
    readinessFor,
    projectSummary: summaryForSupportedRecord,
    skippedReadiness,
    conformanceFailedReadiness,
  });

  const snapshotSettings = createSnapshotSettingsActions({
    documents,
    getSettings,
    findBindingForIdentity,
    projectSummary: summaryForSupportedRecord,
    discardBindingSecret: credentialLifecycle.discardBindingSecret,
    encodeDecodedBinding: credentialLifecycle.encodeDecodedBinding,
  });

  const runConfigurationAction = async (
    action: ClientConfigurationAction,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const parsed = ClientConfigurationActionSchema.safeParse(action);
    if (!parsed.success)
      return err(configurationActionFailure("INVALID_ACTION", "Invalid configuration action"));
    if (parsed.data.action === "test") return conformance.runTestAction(parsed.data);
    // Delete owns its own transaction boundary: it drains admitted executions
    // between two short mutations instead of holding the document locks across
    // a wait that lasts as long as the review it is cancelling.
    if (parsed.data.action === "delete") return crud.runDeleteAction(parsed.data);
    return documents.runMutation(async () => {
      switch (parsed.data.action) {
        case "create":
          return crud.runCreateAction(parsed.data);
        case "inspect":
          return crud.runInspectAction(parsed.data);
        case "select":
          return crud.runSelectAction(parsed.data);
        case "update":
          return crud.runUpdateAction(parsed.data);
        default:
          return err(configurationActionFailure("INVALID_ACTION", "Invalid configuration action"));
      }
    });
  };

  const actions = {
    updateSettings: snapshotSettings.updateSettings,
    readConfigurationSnapshot: snapshotSettings.readConfigurationSnapshot,
    runConfigurationAction,
    recordConfigurationEvidence: conformance.recordConfigurationEvidence,
  } satisfies ConfigurationActions;

  return actions;
}
