import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ConfigurationId,
  Readiness,
  ReadinessAction,
  ReadinessRemediationCode,
  ReadinessStatus,
} from "@diffgazer/core/schemas/config";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../ai/admission/protocol.js";
import { findSecretBinding } from "./persistence/secrets.js";
import { computeProviderReadinessResult } from "./readiness.js";
import { credentialReferenceIdentityFor } from "./store/credential-lifecycle.js";
import { getStore } from "./store.js";
import type { ConfigurationActionError } from "./types.js";

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

const verdictReadFailure = (): ConfigurationActionError =>
  createError<ConfigurationActionError["code"]>("PERSIST_FAILED", "Failed to read configuration");

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
 * Projects the setup/readiness verdict for the selected V2 configuration. It
 * gates nothing on its own: every state keeps its distinct status and exact
 * remediation, and `requireSetup` decides what passes with `canAttemptReview`.
 * The verdict is computed by the store from the configuration record, its
 * secret binding, and live admission evidence — it never inspects API keys, and
 * it exposes no credential, path, or reference detail.
 */
export const getSetupVerdict = async (): Promise<
  Result<SetupVerdict, ConfigurationActionError>
> => {
  const current = await getStore().readCurrentState();
  if (!current.ok) return current;
  const selectedConfigurationId = current.value.config.selectedConfigurationId;
  if (selectedConfigurationId === null) {
    const readiness = computeProviderReadinessResult({ configuration: null }).readiness;
    return ok(verdictFromReadiness(readiness, null));
  }

  const selected = current.value.config.configurations.find((entry) =>
    entry.status === "supported"
      ? entry.record.configurationId === selectedConfigurationId
      : entry.configurationId === selectedConfigurationId,
  );
  if (!selected) return err(verdictReadFailure());
  if (selected.status !== "supported") {
    // A retired product's configuration stays selected on disk; it reads as
    // unsupported instead of failing the whole setup verdict.
    const readiness = computeProviderReadinessResult({ configuration: selected }).readiness;
    return ok(verdictFromReadiness(readiness, selectedConfigurationId));
  }
  const binding = findSecretBinding(
    current.value.secrets,
    selected.record.configurationId,
    selected.record.revision,
  );
  const evidence =
    current.value.evidenceByConfiguration.get(selected.record.configurationId) ?? null;
  const readiness = computeProviderReadinessResult({
    configuration: selected.record,
    binding,
    evidence,
    runtime: RUNTIME_IDENTITY,
    structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
    credentialReferenceIdentity: credentialReferenceIdentityFor(binding),
  }).readiness;
  return ok(verdictFromReadiness(readiness, selected.record.configurationId));
};
