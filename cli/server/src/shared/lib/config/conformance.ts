import { getErrorMessage } from "@diffgazer/core/errors";
import type { Result } from "@diffgazer/core/result";
import type { ConfigurationId } from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import type { AdmissionEvidence } from "./admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";
import type { SecretBinding } from "./secret-bindings.js";
import type { ConfigurationActionError } from "./types.js";

/**
 * The immutable tuple a single conformance observation is made against. Every
 * field is server-owned; credential and workspace references are digests, never
 * their values.
 */
export interface ConfigurationConformanceSubject {
  readonly record: SupportedProviderConfigurationRecord;
  readonly binding: SecretBinding | null;
  readonly credentialReferenceIdentity: string | null;
  readonly workspaceAccountReference: string | null;
}

export type ConfigurationConformanceObservation =
  | { readonly status: "passed"; readonly evidence: AdmissionEvidence }
  | { readonly status: "failed" | "skipped"; readonly reason: string };

/**
 * The transport-side observation. The probe owns discovery and conformance for
 * the subject's transport family and returns the admission evidence it proved,
 * including the runtime identity and structured-output schema digest that
 * review admission will later require.
 */
export type ConfigurationConformanceProbe = (input: {
  readonly subject: ConfigurationConformanceSubject;
  readonly signal: AbortSignal;
}) => Promise<ConfigurationConformanceObservation>;

export interface ConfigurationEvidenceRecorder {
  readonly recordConfigurationEvidence: (
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ) => Promise<Result<boolean, ConfigurationActionError>>;
}

// `shared/` must not import transport features, so the composition root
// registers the real probe at startup. The unregistered default reports a
// skipped observation, which never becomes evidence: an unwired server refuses
// to admit rather than admitting on an unobserved tuple.
const unregisteredProbe: ConfigurationConformanceProbe = async () => {
  log("error", "conformance_probe_not_registered");
  return { status: "skipped", reason: "No conformance probe is registered" };
};

let conformanceProbe: ConfigurationConformanceProbe = unregisteredProbe;

export function setConfigurationConformanceProbe(probe: ConfigurationConformanceProbe): void {
  conformanceProbe = probe;
}

/**
 * Run the probe under the configuration's own admitted wall time. A probe that
 * ignores the abort signal still loses the race, so Test can never outlive the
 * budget the configuration was admitted with.
 */
export async function observeConfigurationConformance(
  subject: ConfigurationConformanceSubject,
): Promise<ConfigurationConformanceObservation> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exceededWallTime = new Promise<ConfigurationConformanceObservation>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({
        status: "failed",
        reason: "Conformance observation exceeded its admitted wall time",
      });
    }, subject.record.budget.wallTimeMs);
  });

  try {
    return await Promise.race([
      conformanceProbe({ subject, signal: controller.signal }),
      exceededWallTime,
    ]);
  } catch (cause) {
    return { status: "failed", reason: getErrorMessage(cause) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Observe the subject once and persist tuple-bound admission evidence only for
 * a passed observation. Failed, skipped, and timed-out observations leave the
 * configuration without evidence, so readiness stays fail-closed.
 */
export async function runConfigurationConformance(
  subject: ConfigurationConformanceSubject,
  recorder: ConfigurationEvidenceRecorder,
): Promise<ConfigurationConformanceObservation> {
  const observation = await observeConfigurationConformance(subject);
  if (observation.status !== "passed") return observation;
  if (observation.evidence.status !== "passed") {
    return { status: "failed", reason: "Conformance observation carries unpassed evidence" };
  }

  const recorded = await recorder.recordConfigurationEvidence(
    subject.record.configurationId,
    observation.evidence,
  );
  if (!recorded.ok) {
    log("warn", "conformance_evidence_not_recorded", { error: recorded.error.message });
    return { status: "failed", reason: recorded.error.message };
  }
  return observation;
}
