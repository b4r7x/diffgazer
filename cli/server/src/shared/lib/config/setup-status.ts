import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ConfigurationId,
  Readiness,
  ReadinessAction,
  ReadinessRemediationCode,
  ReadinessStatus,
  SetupStatus,
} from "@diffgazer/core/schemas/config";
import { loadConfigV2 } from "./persistence/config.js";
import { loadSecretsV2, type SecretsDocumentV2 } from "./persistence/secrets.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";
import { computeProviderReadinessResult } from "./readiness.js";
import type { SecretBinding } from "./secret-bindings.js";
import { getStore } from "./store.js";
import type { ConfigDocumentV2, SecretsStorageError, SecretsStorageErrorCode } from "./types.js";

export interface SetupVerdict {
  readonly configurationId: ConfigurationId | null;
  readonly status: ReadinessStatus;
  readonly ready: boolean;
  readonly action: ReadinessAction;
  readonly explanation: string;
  readonly remediation: {
    readonly code: ReadinessRemediationCode;
    readonly message: string;
  };
}

const verdictReadFailure = (): SecretsStorageError =>
  createError<SecretsStorageErrorCode>("PERSIST_FAILED", "Failed to read configuration");

function loadV2Documents(): Result<
  { config: ConfigDocumentV2; secrets: SecretsDocumentV2 },
  SecretsStorageError
> {
  try {
    return ok({ config: loadConfigV2(), secrets: loadSecretsV2() });
  } catch {
    return err(verdictReadFailure());
  }
}

function selectedRecordFrom(
  document: ConfigDocumentV2,
): SupportedProviderConfigurationRecord | null {
  if (document.selectedConfigurationId === null) return null;
  const selected = document.configurations.find(
    (record) =>
      record.status === "supported" &&
      record.record.configurationId === document.selectedConfigurationId,
  );
  if (!selected || selected.status !== "supported") return null;
  return selected.record;
}

function bindingFor(
  document: SecretsDocumentV2,
  configurationId: ConfigurationId,
  revision: number,
): SecretBinding | null {
  for (const entry of document.bindings) {
    const binding = entry.binding;
    if (binding && binding.configurationId === configurationId && binding.revision === revision) {
      return binding;
    }
  }
  return null;
}

/** Map any client-safe readiness value to the setup verdict contract unchanged. */
export function verdictFromReadiness(
  readiness: Readiness,
  configurationId: ConfigurationId | null,
): SetupVerdict {
  return {
    configurationId,
    status: readiness.status,
    ready: readiness.ready,
    action: readiness.action,
    explanation: readiness.explanation,
    remediation: { ...readiness.remediation },
  };
}

/**
 * The setup/readiness verdict for the selected V2 configuration. Only a
 * readiness of `ready` passes; every other state keeps its distinct status and
 * exact remediation. The verdict is computed by the store from the
 * configuration record, its secret binding, and live admission evidence — it
 * never inspects API keys, and it exposes no credential, path, or reference
 * detail.
 */
export const getSetupVerdict = async (): Promise<Result<SetupVerdict, SecretsStorageError>> => {
  const documents = loadV2Documents();
  if (!documents.ok) return documents;
  const selectedConfigurationId = documents.value.config.selectedConfigurationId;
  if (selectedConfigurationId === null) {
    const readiness = computeProviderReadinessResult({ configuration: null }).readiness;
    return ok(verdictFromReadiness(readiness, null));
  }
  const result = await getStore().runConfigurationAction({
    action: "inspect",
    configurationId: selectedConfigurationId,
  });
  if (!result.ok) return err(verdictReadFailure());
  if (!result.value.readiness) return err(verdictReadFailure());
  return ok(
    verdictFromReadiness(
      result.value.readiness,
      result.value.configuration?.configurationId ?? null,
    ),
  );
};

/**
 * Legacy projection for pre-T-039 callers (config service); the review gate uses
 * `getSetupVerdict` / `requireSetup` only. Derived from the same V2 selected
 * configuration; readiness is fail-closed because live admission evidence is not on disk.
 */
export const getSetupStatus = (projectRoot?: string): Result<SetupStatus, SecretsStorageError> => {
  const store = getStore();
  const documents = loadV2Documents();
  if (!documents.ok) return documents;

  const selected = selectedRecordFrom(documents.value.config);
  const hasProvider = selected !== null;
  const hasModel = selected?.selectedModelId != null;
  const hasSecretsStorage = store.getSettings().secretsStorage !== null;
  const hasTrust = store.getProjectInfo(projectRoot).trust?.capabilities.readFiles === true;

  const missing: string[] = [];
  if (!hasProvider) missing.push("provider");
  if (!hasModel) missing.push("model");
  if (!hasTrust) missing.push("trust");
  if (!hasSecretsStorage) missing.push("secrets storage");

  const readiness = selected
    ? computeProviderReadinessResult({
        configuration: selected,
        binding: bindingFor(documents.value.secrets, selected.configurationId, selected.revision),
      }).readiness
    : null;

  return ok({
    hasSecretsStorage,
    hasProvider,
    hasModel,
    hasTrust,
    isConfigured: hasProvider,
    isReady: readiness?.status === "ready",
    missing,
  });
};
