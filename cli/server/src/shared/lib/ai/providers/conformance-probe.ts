import type { TerminalOutcome } from "@diffgazer/core/schemas/review";
import {
  buildExpectedEvidenceKey,
  createAdmissionEvidence,
} from "../../config/admission-evidence.js";
import type { ConfigurationConformanceProbe } from "../../config/conformance.js";
import { resolveSecretBinding } from "../../config/secret-bindings.js";
import { secretIO } from "../../config/secret-io.js";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../admission/protocol.js";
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
 * review admission later recomputes.
 */
export function createConformanceProbe(): ConfigurationConformanceProbe {
  return async ({ subject, signal }) => {
    const { record, binding } = subject;
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
