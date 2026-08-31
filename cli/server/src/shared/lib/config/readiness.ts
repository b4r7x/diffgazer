import {
  isModelIdAllowedForProduct,
  PRODUCT_REGISTRY,
  type RunnableProductDescriptor,
} from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import {
  READINESS_PRESENTATION,
  type Readiness,
  type ReadinessAcknowledgement,
  type ReadinessEvidenceStatus,
  ReadinessSchema,
  type ReadinessStatus,
} from "@diffgazer/core/schemas/config";
import type { EvidenceKey, RuntimeIdentity } from "@diffgazer/core/schemas/review";
import {
  type AdmissionEvidence,
  buildExpectedEvidenceKey,
  canAuthorizeEvidence,
  evidenceMatchesKey,
} from "./admission-evidence.js";
import type {
  ProviderConfigurationRecord,
  SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import { type SecretBinding, SecretBindingSchema } from "./secret-binding-model.js";
import { bindingCredentialAvailable } from "./secret-bindings.js";

/**
 * Values needed to recompute readiness are all server-owned.  Readiness derives
 * the tuple it expects from the record itself, so `runtime` and
 * `structuredOutputSchemaSha256` must be this server's own identity — reading
 * them off the stored evidence would let evidence vouch for itself.
 */
export interface ProviderReadinessInput {
  readonly configuration: ProviderConfigurationRecord | null | undefined;
  readonly binding?: SecretBinding | null;
  readonly evidence?: AdmissionEvidence | null;
  /** Admission protocol revision this server speaks. */
  readonly runtime?: RuntimeIdentity;
  /** Digest of the structured review schema this server speaks. */
  readonly structuredOutputSchemaSha256?: string;
  readonly now?: Date | string;
  /** Digest of the currently bound credential reference, when applicable. */
  readonly credentialReferenceIdentity?: string | null;
}

interface SafeReadinessDetails {
  readonly status: ReadinessStatus;
  readonly checkedAt: string | null;
  readonly evidenceStatus: ReadinessEvidenceStatus;
  readonly evidenceKeyHash: string | null;
}

export interface ProviderReadinessResult {
  readonly readiness: Readiness;
  readonly details: SafeReadinessDetails;
}

function acknowledgementFor(
  product: RunnableProductDescriptor<RunnableProductId>,
  record: SupportedProviderConfigurationRecord,
): ReadinessAcknowledgement {
  const acknowledgement = record.acknowledgement;
  if (
    acknowledgement.noticeId === product.notice.id &&
    acknowledgement.noticeVersion === product.notice.noticeVersion &&
    acknowledgement.acceptedAt !== null
  ) {
    return {
      status: "accepted",
      noticeId: product.notice.id,
      noticeVersion: product.notice.noticeVersion,
      acceptedAt: acknowledgement.acceptedAt,
    };
  }
  return {
    status: "required",
    noticeId: product.notice.id,
    noticeVersion: product.notice.noticeVersion,
  };
}

function notApplicableAcknowledgement(): ReadinessAcknowledgement {
  return { status: "not-applicable" };
}

export function buildReadiness(
  status: ReadinessStatus,
  checkedAt: string | null,
  evidenceStatus: ReadinessEvidenceStatus,
  acknowledgement: ReadinessAcknowledgement,
): Readiness {
  const presentation = READINESS_PRESENTATION[status];
  return ReadinessSchema.parse({
    status,
    ready: status === "ready",
    evidenceStatus,
    checkedAt,
    acknowledgement,
    ...presentation,
  });
}

function detailsFor(
  readiness: Readiness,
  evidence: AdmissionEvidence | null | undefined,
): SafeReadinessDetails {
  return {
    status: readiness.status,
    checkedAt: readiness.checkedAt,
    evidenceStatus: readiness.evidenceStatus,
    evidenceKeyHash: evidence?.evidenceKeyHash ?? null,
  };
}

function isActiveBindingFor(
  record: SupportedProviderConfigurationRecord,
  binding: SecretBinding | null | undefined,
): boolean {
  if (!binding) return false;
  const parsed = SecretBindingSchema.safeParse(binding);
  if (!parsed.success) return false;
  if (
    parsed.data.status !== "active" ||
    parsed.data.configurationId !== record.configurationId ||
    parsed.data.revision !== record.revision
  ) {
    return false;
  }

  return parsed.data.kind !== "none";
}

/**
 * The tuple this server would prove today.  Returns null when the caller did
 * not name its own runtime identity, or when the record cannot produce a key at
 * all — either way nothing here can vouch for the stored evidence, and the
 * configuration asks for a re-check rather than failing the whole read.
 */
function expectedEvidenceKeyFor(
  record: SupportedProviderConfigurationRecord,
  input: ProviderReadinessInput,
): EvidenceKey | null {
  if (!input.runtime || !input.structuredOutputSchemaSha256) return null;
  try {
    return buildExpectedEvidenceKey({
      record,
      runtime: input.runtime,
      structuredOutputSchemaSha256: input.structuredOutputSchemaSha256,
      credentialReferenceIdentity: input.credentialReferenceIdentity ?? null,
    });
  } catch {
    return null;
  }
}

/**
 * What the stored evidence says about the tuple this server would prove today.
 * An observation of a different tuple says nothing about this one — neither
 * that it works nor that it failed — so the cached verdict clears the moment
 * the tuple changes, matching the admission path's unproven admit. A passed
 * observation that cannot authorize — a campaign-era record past its
 * `expiresAt`, say — never failed the structured-output contract, so it asks
 * for a re-check instead of reporting a failure that never happened.
 */
function observedEvidenceStatus(
  record: SupportedProviderConfigurationRecord,
  input: ProviderReadinessInput,
): "pending" | "failed" | "passed" {
  if (!input.evidence) return "pending";
  const expectedEvidenceKey = expectedEvidenceKeyFor(record, input);
  if (expectedEvidenceKey === null || !evidenceMatchesKey(input.evidence, expectedEvidenceKey)) {
    return "pending";
  }
  if (input.evidence.status === "failed") return "failed";
  if (!canAuthorizeEvidence(input.evidence, expectedEvidenceKey, { now: input.now })) {
    return "pending";
  }
  return "passed";
}

/**
 * Recompute a client-safe readiness value from server-owned records.  No
 * credential/path/reference value is copied into the returned contract; the
 * only evidence detail retained is its SHA-256 identity hash.
 */
export function computeProviderReadiness(input: ProviderReadinessInput): Readiness {
  return computeProviderReadinessResult(input).readiness;
}

export function computeProviderReadinessResult(
  input: ProviderReadinessInput,
): ProviderReadinessResult {
  const configuration = input.configuration;
  if (!configuration) {
    const readiness = buildReadiness("unconfigured", null, "not-checked", {
      status: "not-applicable",
    });
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (configuration.status === "unknown") {
    const readiness = buildReadiness(
      "unsupported",
      null,
      "not-checked",
      notApplicableAcknowledgement(),
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const record = configuration;
  const product = PRODUCT_REGISTRY[record.productId];
  const acknowledgement = acknowledgementFor(product, record);

  if (!isActiveBindingFor(record, input.binding)) {
    const readiness = buildReadiness(
      "credential-invalid",
      new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const selectedModelId = record.selectedModelId;
  if (selectedModelId === null || !isModelIdAllowedForProduct(record.productId, selectedModelId)) {
    const readiness = buildReadiness(
      "model-missing",
      new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const checkedAt = input.evidence?.checkedAt ?? new Date().toISOString();
  const evidenceStatus = observedEvidenceStatus(record, input);

  // The notice must be accepted before the first context send, so an
  // outstanding acknowledgement outranks the evidence: an unacknowledged record
  // is refused whether its tuple is unproven, failed, or proven.
  if (acknowledgement.status !== "accepted") {
    const readiness = buildReadiness(
      "acknowledgement-required",
      checkedAt,
      evidenceStatus,
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (evidenceStatus === "pending") {
    const readiness = buildReadiness("conformance-pending", checkedAt, "pending", acknowledgement);
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (evidenceStatus === "failed") {
    const readiness = buildReadiness("conformance-failed", checkedAt, "failed", acknowledgement);
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (!bindingCredentialAvailable(input.binding)) {
    const readiness = buildReadiness(
      "credential-invalid",
      new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const readiness = buildReadiness("ready", checkedAt, "passed", acknowledgement);
  return { readiness, details: detailsFor(readiness, input.evidence) };
}
