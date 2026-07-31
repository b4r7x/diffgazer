import {
  type ModelPolicy,
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
import {
  type EvidenceKey,
  EvidenceKeySchema,
  type ExecutionLimits,
} from "@diffgazer/core/schemas/review";
import {
  type AdmissionEvidence,
  canAuthorizeEvidence,
  evidenceMatchesKey,
} from "./admission-evidence.js";
import {
  NonSecretTransportInputSchema,
  type ProviderConfigurationRecord,
  type SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import { type SecretBinding, SecretBindingSchema } from "./secret-bindings.js";

/**
 * A local probe is intentionally separate from admission evidence.  Evidence
 * records say whether a review conformance observation passed; this probe says
 * which local boundary failed before a review could be attempted.
 */
export const LOCAL_READINESS_OBSERVATION_STATUSES = [
  "passed",
  "endpoint-unreachable",
  "endpoint-forbidden",
  "api-incompatible",
  "no-review-capable-model",
  "selected-model-missing",
  "conformance-failed",
  "cancellation-failed",
] as const;
export type LocalReadinessObservationStatus = (typeof LOCAL_READINESS_OBSERVATION_STATUSES)[number];

export interface LocalReadinessObservation {
  readonly status: LocalReadinessObservationStatus;
  readonly checkedAt: string;
}

/**
 * Values needed to recompute readiness are all server-owned.  In particular,
 * `evidenceKey` is the immutable tuple that was actually probed; it contains
 * digests for credential/workspace references, never their values.
 */
export interface ProviderReadinessInput {
  readonly configuration: ProviderConfigurationRecord | null | undefined;
  readonly binding?: SecretBinding | null;
  readonly evidence?: AdmissionEvidence | null;
  readonly evidenceKey?: EvidenceKey | null;
  readonly now?: Date | string;
  readonly localObservation?: LocalReadinessObservation | null;
  /** Digest of the currently bound credential reference, when applicable. */
  readonly credentialReferenceIdentity?: string | null;
  /** Digest of the currently bound workspace/account reference, when applicable. */
  readonly workspaceAccountReference?: string | null;
}

export interface SafeReadinessDetails {
  readonly status: ReadinessStatus;
  readonly checkedAt: string | null;
  readonly evidenceStatus: ReadinessEvidenceStatus;
  readonly evidenceKeyHash: string | null;
}

export interface ProviderReadinessResult {
  readonly readiness: Readiness;
  readonly details: SafeReadinessDetails;
}

const LOCAL_FAILURE_STATUS: Readonly<
  Record<Exclude<LocalReadinessObservationStatus, "passed">, ReadinessStatus>
> = {
  "endpoint-unreachable": "local-endpoint-unreachable",
  "endpoint-forbidden": "local-endpoint-forbidden",
  "api-incompatible": "local-api-incompatible",
  "no-review-capable-model": "local-no-review-capable-model",
  "selected-model-missing": "local-selected-model-missing",
  "conformance-failed": "local-conformance-failed",
  "cancellation-failed": "local-cancellation-failed",
};

function acknowledgementFor(
  product: RunnableProductDescriptor<RunnableProductId>,
  record: SupportedProviderConfigurationRecord,
): ReadinessAcknowledgement {
  const acknowledgement = record.acknowledgement;
  if (
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

function buildReadiness(
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

  if (record.transportFamily === "hosted-api") {
    return parsed.data.kind !== "none";
  }
  if (record.input.transportFamily === "local-http") {
    return record.input.authentication === "none"
      ? parsed.data.kind === "none"
      : parsed.data.kind === "optional-local-bearer";
  }
  return parsed.data.kind === "none";
}

function isExactModelForProduct(
  productId: SupportedProviderConfigurationRecord["productId"],
  modelId: string,
): boolean {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy as ModelPolicy;
  switch (policy.kind) {
    case "discovered-family":
      return (
        !policy.rejectedAliases.includes(modelId) &&
        policy.familyPrefixes.some(
          (prefix) => modelId === prefix || modelId.startsWith(`${prefix}-`),
        )
      );
    case "discovered-exact":
      // There is no client-safe opt-in field for these models.  Keep the
      // server calculation fail-closed until admission records that proof.
      return !policy.explicitOptInSuffixes?.some((suffix) => modelId.endsWith(suffix));
    case "discovered-allowlist":
      if (!policy.modelIds.includes(modelId)) return false;
      // Higher-cost models require provider-specific output-limit evidence;
      // generic conformance is not sufficient for readiness.
      return !(
        policy.higherCostModelEvidence !== undefined && policy.higherCostModelIds?.includes(modelId)
      );
    case "pinned-downstream-route":
      return isPinnedDownstreamRouteModel(modelId);
  }
}

const PINNED_ROUTE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RESERVED_PINNED_ROUTE_SEGMENTS = new Set([
  "auto",
  "automatic",
  "cheapest",
  "default",
  "exacto",
  "extended",
  "fallback",
  "fastest",
  "floor",
  "free",
  "nitro",
  "online",
  "openrouter",
  "random",
  "route",
  "thinking",
]);

function isPinnedDownstreamRouteModel(modelId: string): boolean {
  if (!PINNED_ROUTE_PATTERN.test(modelId)) return false;
  const [provider = "", route = ""] = modelId.split("/");
  return ![provider, route].some((segment) =>
    RESERVED_PINNED_ROUTE_SEGMENTS.has(segment.toLowerCase()),
  );
}

function expectedEndpoint(record: SupportedProviderConfigurationRecord): string | null {
  if (record.input.transportFamily === "local-cli") return null;
  return record.input.endpoint;
}

function expectedRegion(record: SupportedProviderConfigurationRecord): string | null {
  if (record.input.transportFamily !== "hosted-api") return null;
  return record.input.region ?? null;
}

function budgetsMatch(
  record: SupportedProviderConfigurationRecord,
  limits: ExecutionLimits,
): boolean {
  const budget = record.budget;
  return (
    budget.inputTokens === limits.maxInputTokens &&
    budget.outputTokens === limits.maxOutputTokens &&
    budget.responseBytes === limits.maxResponseBytes &&
    budget.wallTimeMs === limits.wallTimeMs &&
    budget.retries === limits.maxRetries &&
    budget.concurrency === limits.maxConcurrency &&
    budget.perReview === limits.maxCostUsd
  );
}

function evidenceMatchesConfiguration(
  record: SupportedProviderConfigurationRecord,
  evidenceKey: EvidenceKey,
  input: ProviderReadinessInput,
): boolean {
  if (
    evidenceKey.productId !== record.productId ||
    evidenceKey.transportFamily !== record.transportFamily ||
    evidenceKey.normalizedEndpoint !== expectedEndpoint(record) ||
    evidenceKey.region !== expectedRegion(record) ||
    evidenceKey.modelId !== record.selectedModelId ||
    evidenceKey.workspaceAccountReference !== (input.workspaceAccountReference ?? null) ||
    evidenceKey.credentialReferenceIdentity !== (input.credentialReferenceIdentity ?? null) ||
    !budgetsMatch(record, evidenceKey.limits)
  ) {
    return false;
  }

  if (record.input.transportFamily === "local-http") {
    return (
      evidenceKey.authentication === record.input.authentication &&
      evidenceKey.installationId === null
    );
  }
  if (record.input.transportFamily === "local-cli") {
    return (
      evidenceKey.authentication === null &&
      evidenceKey.installationId === record.input.installationId
    );
  }
  return evidenceKey.authentication === null && evidenceKey.installationId === null;
}

function configurationTransportIsValid(record: SupportedProviderConfigurationRecord): boolean {
  return NonSecretTransportInputSchema.safeParse(record.input).success;
}

function localObservationStatus(
  observation: LocalReadinessObservation | null | undefined,
): ReadinessStatus | null {
  if (!observation || observation.status === "passed") return null;
  return LOCAL_FAILURE_STATUS[observation.status];
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

  if (configuration.status === "removed") {
    const readiness = buildReadiness(
      "removed",
      null,
      "not-checked",
      notApplicableAcknowledgement(),
    );
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
  const observation = input.localObservation;
  const observedLocalFailure = localObservationStatus(observation);

  if (!configurationTransportIsValid(record)) {
    const status =
      record.transportFamily === "local-http" ? "local-endpoint-forbidden" : "endpoint-invalid";
    const readiness = buildReadiness(
      status,
      observation?.checkedAt ?? new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (!isActiveBindingFor(record, input.binding)) {
    const readiness = buildReadiness(
      "credential-invalid",
      observation?.checkedAt ?? new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (observedLocalFailure) {
    const readiness = buildReadiness(
      observedLocalFailure,
      observation?.checkedAt ?? new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const selectedModelId = record.selectedModelId;
  if (selectedModelId === null || !isExactModelForProduct(record.productId, selectedModelId)) {
    const readiness = buildReadiness(
      "model-missing",
      observation?.checkedAt ?? new Date().toISOString(),
      "failed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const checkedAt = input.evidence?.checkedAt ?? observation?.checkedAt ?? new Date().toISOString();
  const expectedEvidenceKey = input.evidenceKey
    ? EvidenceKeySchema.safeParse(input.evidenceKey)
    : { success: false as const };

  if (
    !input.evidence ||
    input.evidence.status === "not-checked" ||
    input.evidence.status === "skipped"
  ) {
    const status = input.evidence?.status === "skipped" ? "skipped" : "conformance-pending";
    const readiness = buildReadiness(
      status,
      checkedAt,
      status === "skipped" ? "skipped" : "pending",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (input.evidence.status === "pending") {
    const readiness = buildReadiness("conformance-pending", checkedAt, "pending", acknowledgement);
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (
    input.evidence.status === "failed" ||
    input.evidence.status === "expired" ||
    !expectedEvidenceKey.success ||
    !evidenceMatchesConfiguration(record, expectedEvidenceKey.data, input) ||
    !evidenceMatchesKey(input.evidence, expectedEvidenceKey.data) ||
    !canAuthorizeEvidence(input.evidence, expectedEvidenceKey.data, { now: input.now })
  ) {
    const status =
      record.transportFamily === "hosted-api" ? "conformance-failed" : "local-conformance-failed";
    const readiness = buildReadiness(status, checkedAt, "failed", acknowledgement);
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  if (acknowledgement.status !== "accepted") {
    const readiness = buildReadiness(
      "acknowledgement-required",
      checkedAt,
      "passed",
      acknowledgement,
    );
    return { readiness, details: detailsFor(readiness, input.evidence) };
  }

  const readiness = buildReadiness("ready", checkedAt, "passed", acknowledgement);
  return { readiness, details: detailsFor(readiness, input.evidence) };
}

/** Alias kept for service code that describes this operation as a calculation. */
export const computeReadiness = computeProviderReadiness;

/** Validate a readiness value before crossing the server/client boundary. */
export function toSafeReadiness(readiness: Readiness): Readiness {
  return ReadinessSchema.parse(readiness);
}
