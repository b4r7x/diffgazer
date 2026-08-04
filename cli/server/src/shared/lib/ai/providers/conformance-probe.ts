import type { TerminalOutcome } from "@diffgazer/core/schemas/review";
import { createAdmissionEvidence } from "../../config/admission-evidence.js";
import type { ConfigurationConformanceProbe } from "../../config/conformance.js";
import { resolveSecretBinding } from "../../config/secret-bindings.js";
import { buildExpectedEvidenceKey } from "../admission/service.js";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../client/initialize.js";
import { HOSTED_ADAPTERS } from "./hosted/transport.js";

const CONFORMANCE_PROMPT = 'Return {"issues":[]} as JSON.';

/** Credential-safe reasons per terminal outcome; never provider payload text. */
const FAILURE_REASONS: Record<Exclude<TerminalOutcome, "completed">, string> = {
  cancelled: "Conformance observation was cancelled",
  "timed-out": "Provider did not respond within the admitted wall time",
  "transport-failed": "Provider request failed (credential, endpoint, or rate limit)",
  "schema-failed": "Provider response did not satisfy the structured review contract",
  "budget-exhausted": "Conformance observation exceeded the configuration budget",
};

/**
 * Observes a hosted configuration through its production adapter: one
 * structured review request must complete against the exact evidence tuple
 * review admission later recomputes. Non-hosted transports are skipped, not
 * failed — their readiness stays fail-closed until a local probe exists.
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
      workspaceAccountReference: subject.workspaceAccountReference,
    });

    const execution = await HOSTED_ADAPTERS[record.input.productId].execute({
      configurationId: record.configurationId,
      configurationRevision: record.revision,
      evidenceKey,
      prompt: CONFORMANCE_PROMPT,
      signal,
      resolveCredential: () =>
        resolveSecretBinding(binding, undefined, {
          configurationId: record.configurationId,
          revision: record.revision,
        }),
      workspaceAccountId: record.input.workspace ?? null,
    });

    if (execution.receipt.outcome !== "completed") {
      return { status: "failed", reason: FAILURE_REASONS[execution.receipt.outcome] };
    }

    return {
      status: "passed",
      evidence: createAdmissionEvidence({
        evidenceKey,
        checkedAt: new Date().toISOString(),
        status: "passed",
      }),
    };
  };
}
