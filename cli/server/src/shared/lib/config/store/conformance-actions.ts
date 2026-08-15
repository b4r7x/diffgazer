import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ClientConfigurationAction,
  type ClientConfigurationActionResponse,
  ClientConfigurationActionResponseSchema,
  type ClientConfigurationSummary,
  type ConfigurationId,
  type Readiness,
  type ReadinessAcknowledgement,
} from "@diffgazer/core/schemas/config";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../../ai/admission/protocol.js";
import { log } from "../../log.js";
import type { AdmissionEvidence } from "../admission-evidence.js";
import {
  AdmissionEvidenceSchema,
  buildExpectedEvidenceKey,
  evidenceMatchesKey,
} from "../admission-evidence.js";
import {
  type ConfigurationConformanceObservation,
  type ConfigurationConformanceSubject,
  runConfigurationConformance,
} from "../conformance.js";
import type {
  DecodedProviderConfigurationRecord,
  ProviderConfigurationRecord,
  SupportedProviderConfigurationRecord,
} from "../provider-config.js";
import type { SecretBinding } from "../secret-bindings.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";
import {
  credentialReferenceIdentityFor,
  workspaceAccountReferenceFor,
} from "./credential-lifecycle.js";
import { type DocumentStore, evidenceReferenceFor } from "./document-store.js";

type ConformanceActionDependencies = Readonly<{
  documents: DocumentStore;
  findRecord: (configurationId: ConfigurationId) => DecodedProviderConfigurationRecord | undefined;
  findBindingForIdentity: (
    configurationId: ConfigurationId,
    revision: number,
  ) => SecretBinding | null;
  readinessFor: (configuration: ProviderConfigurationRecord | null) => Readiness;
  projectSummary: (
    record: SupportedProviderConfigurationRecord,
  ) => Result<ClientConfigurationSummary, ConfigurationActionError>;
  skippedReadiness: () => Readiness;
  conformanceFailedReadiness: (acknowledgement: ReadinessAcknowledgement) => Readiness;
}>;

export function createConformanceActions(deps: ConformanceActionDependencies) {
  const conformanceSubjectFor = (
    configurationId: ConfigurationId,
  ): Result<ConfigurationConformanceSubject, ConfigurationActionError> => {
    const record = deps.findRecord(configurationId);
    if (!record)
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    const binding = deps.findBindingForIdentity(configurationId, record.record.revision);
    return ok({
      record: record.record,
      binding,
      credentialReferenceIdentity: credentialReferenceIdentityFor(binding),
      workspaceAccountReference: workspaceAccountReferenceFor(record.record),
    });
  };

  /**
   * The response describes the observation this action made, not whatever
   * verdict already sat on disk. A probe that failed or declined to run leaves
   * the stored evidence untouched — the next read reports the admission state
   * again — but this response must never present an untested tuple as tested.
   */
  const observedTestReadiness = (
    readiness: Readiness,
    observation: ConfigurationConformanceObservation,
  ): Readiness => {
    if (observation.status === "passed") return readiness;
    // A definite local diagnosis (missing credential, missing model, an
    // acknowledgement the user still owes) describes the configuration more
    // precisely than the observation can, so it survives.
    if (readiness.status !== "conformance-pending" && !readiness.ready) return readiness;
    if (observation.status === "failed") {
      return deps.conformanceFailedReadiness(readiness.acknowledgement);
    }
    return deps.skippedReadiness();
  };

  const projectTestResponse = (
    configurationId: ConfigurationId,
    observation: ConfigurationConformanceObservation,
  ): Result<ClientConfigurationActionResponse, ConfigurationActionError> => {
    const record = deps.findRecord(configurationId);
    if (!record || record.status !== "supported") {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    const summaryResult = deps.projectSummary(record.record);
    if (!summaryResult.ok) return summaryResult;
    const readiness = observedTestReadiness(deps.readinessFor(record.record), observation);
    return ok(
      ClientConfigurationActionResponseSchema.parse({
        action: "test",
        // Status is this action's own outcome: the probe either proved the
        // tuple or it did not, whatever admission state earlier evidence
        // leaves behind — that state travels in `readiness`. A passed
        // observation over a not-admitted tuple is not a success either: the
        // setup gate would still reject the configuration this response calls
        // tested.
        status:
          observation.status === "passed" &&
          (readiness.ready || readiness.evidenceStatus === "passed")
            ? "succeeded"
            : "failed",
        configuration: summaryResult.value,
        readiness,
      }),
    );
  };

  const runRecordEvidence = async (
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ): Promise<Result<boolean, ConfigurationActionError>> => {
    const parsed = AdmissionEvidenceSchema.safeParse(evidence);
    if (!parsed.success)
      return err(configurationActionFailure("INVALID_ACTION", "Invalid admission evidence"));
    const record = deps.findRecord(configurationId);
    if (!record)
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    // A hosted verdict is proved by this server, so the admission protocol
    // revision is the server's to assert — reading it off the submission would
    // let evidence vouch for the revision it was recorded under. A local
    // runtime is only ever observed on the machine, and the evidence key
    // contract pins which identities its product may carry.
    const expectedRuntime =
      record.record.transportFamily === "hosted-api"
        ? RUNTIME_IDENTITY
        : parsed.data.evidenceKey.runtime;
    let expectedKey: EvidenceKey;
    try {
      expectedKey = buildExpectedEvidenceKey({
        record: record.record,
        runtime: expectedRuntime,
        structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
        credentialReferenceIdentity: credentialReferenceIdentityFor(
          deps.findBindingForIdentity(record.record.configurationId, record.record.revision),
        ),
        workspaceAccountReference: workspaceAccountReferenceFor(record.record),
      });
    } catch {
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "Admission evidence does not match the configuration",
        ),
      );
    }
    if (!evidenceMatchesKey(parsed.data, expectedKey)) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "Admission evidence does not match the configuration",
        ),
      );
    }
    const evidenceReference = evidenceReferenceFor(configurationId);
    const nextRecord: SupportedProviderConfigurationRecord = {
      ...record.record,
      evidenceReference,
      updatedAt: new Date().toISOString(),
    };
    deps.documents.setConfigDocument({
      ...deps.documents.getConfigDocument(),
      configurations: deps.documents.getConfigDocument().configurations.map((candidate) =>
        candidate === record
          ? {
              status: "supported" as const,
              record: nextRecord,
              rawBytes: deps.documents.encodeJsonBytes(nextRecord),
            }
          : candidate,
      ),
    });
    const persisted = await deps.documents.writeDocuments();
    if (!persisted.ok) return persisted;
    // The evidence file sits outside the config+secrets journal, so it is published
    // only once the documents have committed. Writing it first leaves a verdict on
    // disk for a transaction that rolled back — or, on a crash, never landed at all.
    try {
      await deps.documents.writeEvidence(evidenceReference, parsed.data);
    } catch (cause) {
      return err(deps.documents.persistFailure(cause));
    }
    deps.documents.setEvidence(configurationId, parsed.data);
    return ok(true);
  };

  const recordConfigurationEvidence = (
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ): Promise<Result<boolean, ConfigurationActionError>> =>
    deps.documents.runMutation(() => runRecordEvidence(configurationId, evidence));

  const runTestAction = async (
    action: Extract<ClientConfigurationAction, { action: "test" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const subject = await deps.documents.runMutation(async () =>
      conformanceSubjectFor(action.configurationId),
    );
    if (!subject.ok) return subject;
    const observation = await runConfigurationConformance(subject.value, {
      recordConfigurationEvidence,
    });
    if (observation.status === "failed") {
      log("warn", "config_conformance_failed", {
        configurationId: action.configurationId,
        reason: observation.reason,
      });
    }
    return deps.documents.runMutation(async () =>
      projectTestResponse(action.configurationId, observation),
    );
  };

  return { runTestAction, recordConfigurationEvidence };
}
