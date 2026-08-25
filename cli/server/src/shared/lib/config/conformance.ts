import { getErrorMessage } from "@diffgazer/core/errors";
import type { Result } from "@diffgazer/core/result";
import type { ConfigurationId } from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import type { AdmissionEvidence } from "./admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";
import { getConfigSeams } from "./seams.js";
import type { SecretBinding } from "./secret-bindings.js";
import type { ConfigurationActionError } from "./types.js";

/**
 * The immutable tuple a single conformance observation is made against. Every
 * field is server-owned; the credential reference is a digest, never its value.
 */
export interface ConfigurationConformanceSubject {
  readonly record: SupportedProviderConfigurationRecord;
  readonly binding: SecretBinding | null;
  readonly credentialReferenceIdentity: string | null;
}

export type ConfigurationConformanceObservation =
  | { readonly status: "passed"; readonly evidence: AdmissionEvidence }
  | {
      readonly status: "failed";
      readonly reason: string;
      /**
       * Carried only when the observation is a verdict on the tuple itself —
       * the provider answered and the structured review contract rejected the
       * answer. Transport, timeout, budget and cancellation failures say
       * nothing about the tuple and carry nothing.
       */
      readonly evidence?: AdmissionEvidence;
    }
  | { readonly status: "skipped"; readonly reason: string };

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

/**
 * Run the probe under the configuration's own admitted wall time. A probe that
 * ignores the abort signal still loses the race, so Test can never outlive the
 * budget the configuration was admitted with.
 */
async function observeConfigurationConformance(
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
      getConfigSeams().conformanceProbe({ subject, signal: controller.signal }),
      exceededWallTime,
    ]);
  } catch (cause) {
    return { status: "failed", reason: getErrorMessage(cause) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Observe the subject once and persist the tuple-bound admission evidence the
 * observation proved: that it can produce structured review output, or that it
 * cannot. A skipped, transport, timeout, or budget failure proves neither and
 * leaves the configuration's evidence untouched.
 */
export async function runConfigurationConformance(
  subject: ConfigurationConformanceSubject,
  recorder: ConfigurationEvidenceRecorder,
): Promise<ConfigurationConformanceObservation> {
  const observation = await observeConfigurationConformance(subject);
  if (observation.status !== "passed") {
    // The user already paid a live generation to learn this tuple cannot answer
    // in schema. Caching it is what lets the next review fast-fail for free
    // instead of paying a diff-sized call to rediscover the same failure.
    if (observation.status === "failed" && observation.evidence) {
      const recorded = await recorder.recordConfigurationEvidence(
        subject.record.configurationId,
        observation.evidence,
      );
      if (!recorded.ok) {
        log("warn", "conformance_evidence_not_recorded", { error: recorded.error.message });
      }
    }
    return observation;
  }
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
