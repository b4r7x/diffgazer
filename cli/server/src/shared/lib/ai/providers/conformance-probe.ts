import type { RuntimeIdentity, TerminalOutcome } from "@diffgazer/core/schemas/review";
import {
  buildExpectedEvidenceKey,
  createAdmissionEvidence,
} from "../../config/admission-evidence.js";
import type { ConfigurationConformanceProbe } from "../../config/conformance.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import type { LocalReadinessObservationStatus } from "../../config/readiness.js";
import type { SecretBinding } from "../../config/secret-bindings.js";
import { resolveSecretBinding } from "../../config/secret-bindings.js";
import { secretIO } from "../../config/secret-io.js";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../admission/protocol.js";
import {
  type CliCompatibilityProbeProvider,
  runCliCompatibilityProbe,
} from "./cli-compatibility/probe.js";
import { HOSTED_ADAPTERS } from "./hosted/transport.js";
import {
  discoverLocalHttpModels,
  mapDiscoveryFailureToObservation,
  probeLocalHttpConformance,
} from "./local-http/discovery.js";
import type { LocalHttpAuth } from "./local-http/request.js";

const CONFORMANCE_PROMPT = 'Return {"issues":[]} as JSON.';

/** Credential-safe reasons per terminal outcome; never provider payload text. */
const FAILURE_REASONS: Record<Exclude<TerminalOutcome, "completed">, string> = {
  cancelled: "Conformance observation was cancelled",
  "timed-out": "Provider did not respond within the admitted wall time",
  "transport-failed": "Provider request failed (credential, endpoint, or rate limit)",
  "schema-failed": "Provider response did not satisfy the structured review contract",
  "budget-exhausted": "Conformance observation exceeded the configuration budget",
};

const LOCAL_READINESS_FAILURE_REASONS: Record<
  Exclude<LocalReadinessObservationStatus, "passed">,
  string
> = {
  "endpoint-unreachable": "Local endpoint is unreachable",
  "endpoint-forbidden": "Local endpoint is not allowed",
  "api-incompatible": "Local API is incompatible",
  "no-review-capable-model": "No review-capable model was discovered locally",
  "selected-model-missing": "Selected model is not available on the local endpoint",
  "conformance-failed": "Local conformance observation failed",
  "cancellation-failed": "Local transport did not honour cancellation",
};

function isCliCompatibilityProvider(productId: string): productId is CliCompatibilityProbeProvider {
  return productId === "codex-cli" || productId === "copilot-cli";
}

async function resolveLocalHttpAuth(
  record: SupportedProviderConfigurationRecord,
  binding: SecretBinding | null,
): Promise<LocalHttpAuth> {
  const authentication =
    record.input.transportFamily === "local-http" ? record.input.authentication : "none";
  if (authentication !== "optional-local-bearer" || !binding) {
    return { authentication, bearerToken: null };
  }
  const resolved = await resolveSecretBinding(binding, secretIO, {
    configurationId: record.configurationId,
    revision: record.revision,
  });
  return {
    authentication,
    bearerToken: resolved,
  };
}

function passedObservation(
  record: SupportedProviderConfigurationRecord,
  subject: {
    credentialReferenceIdentity: string | null;
  },
  runtime: RuntimeIdentity,
) {
  const checkedAt = new Date().toISOString();
  const evidenceKey = buildExpectedEvidenceKey({
    record,
    structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
    runtime,
    credentialReferenceIdentity:
      record.input.transportFamily === "local-cli" ? null : subject.credentialReferenceIdentity,
  });
  return {
    status: "passed" as const,
    evidence: createAdmissionEvidence({
      evidenceKey,
      checkedAt,
      status: "passed",
      expiresAt: null,
    }),
  };
}

/**
 * Observes a hosted configuration through its production adapter: one
 * structured review request must complete against the exact evidence tuple
 * review admission later recomputes.
 */
export function createHostedConformanceProbe(): ConfigurationConformanceProbe {
  return async ({ subject, signal }) => {
    const { record, binding } = subject;
    if (record.input.transportFamily !== "hosted-api") {
      return {
        status: "skipped",
        reason: "Conformance probing is not implemented for this transport family",
      };
    }
    if (record.selectedModelId === null) {
      return { status: "skipped", reason: "No exact model is selected" };
    }
    if (!binding) {
      return { status: "failed", reason: "No active credential binding" };
    }

    const evidenceKey = buildExpectedEvidenceKey({
      record,
      structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
      runtime: RUNTIME_IDENTITY,
      credentialReferenceIdentity: subject.credentialReferenceIdentity,
    });

    const execution = await HOSTED_ADAPTERS[record.input.productId].execute({
      configurationId: record.configurationId,
      configurationRevision: record.revision,
      evidenceKey,
      prompt: CONFORMANCE_PROMPT,
      signal,
      resolveCredential: () =>
        resolveSecretBinding(binding, secretIO, {
          configurationId: record.configurationId,
          revision: record.revision,
        }),
    });

    if (execution.receipt.outcome !== "completed") {
      const reason = FAILURE_REASONS[execution.receipt.outcome];
      if (execution.receipt.outcome !== "schema-failed") return { status: "failed", reason };
      // The provider answered and the answer did not satisfy the review schema:
      // the same verdict a schema-failed review records, from the path the user
      // paid a billed generation for.
      return {
        status: "failed",
        reason,
        evidence: createAdmissionEvidence({
          evidenceKey,
          checkedAt: new Date().toISOString(),
          status: "failed",
          expiresAt: null,
        }),
      };
    }

    return {
      status: "passed",
      evidence: createAdmissionEvidence({
        evidenceKey,
        checkedAt: new Date().toISOString(),
        status: "passed",
        expiresAt: null,
      }),
    };
  };
}

async function observeLocalHttpConformance(
  subject: Parameters<ConfigurationConformanceProbe>[0]["subject"],
  signal: AbortSignal,
) {
  const { record } = subject;
  if (record.input.transportFamily !== "local-http") {
    return {
      status: "skipped" as const,
      reason: "Conformance probing is not implemented for this transport family",
    };
  }
  if (record.selectedModelId === null) {
    return { status: "skipped" as const, reason: "No exact model is selected" };
  }

  const auth = await resolveLocalHttpAuth(record, subject.binding);
  if (auth.authentication === "optional-local-bearer" && !auth.bearerToken) {
    return { status: "failed" as const, reason: "No active credential binding" };
  }

  const discovery = await discoverLocalHttpModels({
    productId: record.input.productId,
    endpoint: record.input.endpoint,
    auth,
    signal,
  });
  if (!discovery.ok) {
    const status = mapDiscoveryFailureToObservation(discovery.error);
    return {
      status: "failed" as const,
      reason: LOCAL_READINESS_FAILURE_REASONS[status],
    };
  }

  const probe = await probeLocalHttpConformance({
    productId: record.input.productId,
    endpoint: record.input.endpoint,
    modelId: record.selectedModelId,
    auth,
    structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
    signal,
  });

  if (!probe.ok) {
    const status = mapDiscoveryFailureToObservation(probe.error);
    return {
      status: "failed" as const,
      reason: LOCAL_READINESS_FAILURE_REASONS[status],
    };
  }

  if (probe.value !== "passed") {
    return {
      status: "failed" as const,
      reason: LOCAL_READINESS_FAILURE_REASONS[probe.value],
    };
  }

  return passedObservation(record, subject, discovery.value.runtime);
}

async function observeLocalCliConformance(
  subject: Parameters<ConfigurationConformanceProbe>[0]["subject"],
  signal: AbortSignal,
) {
  const { record } = subject;
  if (record.input.transportFamily !== "local-cli") {
    return {
      status: "skipped" as const,
      reason: "Conformance probing is not implemented for this transport family",
    };
  }
  if (record.selectedModelId === null) {
    return { status: "skipped" as const, reason: "No exact model is selected" };
  }
  if (!isCliCompatibilityProvider(record.productId)) {
    return {
      status: "skipped" as const,
      reason: "Conformance probing is not implemented for this transport family",
    };
  }

  // The user pressed Test: one live structured generation against the review
  // schema is all this observation attests, so the hostile negative fixture —
  // a second billed generation — stays with the build-time bundled records.
  const probe = await runCliCompatibilityProbe({
    provider: record.productId,
    modelId: record.selectedModelId,
    liveOptIn: true,
    fixtures: "positive-only",
    signal,
  });

  if (probe.status === "skipped") {
    return { status: "skipped" as const, reason: probe.reason };
  }
  if (probe.status === "unsupported") {
    return { status: "failed" as const, reason: "Local CLI compatibility probe failed" };
  }

  const runtime: RuntimeIdentity = { identity: probe.provider, version: probe.version };

  return passedObservation(record, subject, runtime);
}

/** Production conformance seam: hosted adapters, local HTTP, and local CLI probes. */
export function createConformanceProbe(): ConfigurationConformanceProbe {
  const hosted = createHostedConformanceProbe();
  return async ({ subject, signal }) => {
    const family = subject.record.input.transportFamily;
    if (family === "hosted-api") {
      return hosted({ subject, signal });
    }
    if (family === "local-http") {
      return observeLocalHttpConformance(subject, signal);
    }
    if (family === "local-cli") {
      return observeLocalCliConformance(subject, signal);
    }
    return {
      status: "skipped",
      reason: "Conformance probing is not implemented for this transport family",
    };
  };
}
