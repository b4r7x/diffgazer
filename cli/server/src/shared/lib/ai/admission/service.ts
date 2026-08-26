import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import { canAttemptReview, type RunnableProductId } from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  ExecutionFingerprintInputSchema,
  type ExecutionLimits,
  type RuntimeIdentity,
} from "@diffgazer/core/schemas/review";
import {
  type AdmissionEvidence,
  buildExpectedEvidenceKey,
} from "../../config/admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import { computeProviderReadiness } from "../../config/readiness.js";
import {
  bindingCredentialAvailable,
  resolveSecretBinding,
  type SecretBinding,
} from "../../config/secret-bindings.js";
import { secretIO } from "../../config/secret-io.js";
import { estimateWorstCaseCostUsd } from "../budget/cost.js";
import type { AttemptEstimate, BudgetLedger, BudgetReservation } from "../budget/ledger.js";
import { type Adapter, getAdapter } from "../providers/registry.js";

export type AdmissionFailureCode =
  | "configuration-not-found"
  | "configuration-migration-required"
  | "configuration-unsupported"
  | "configuration-revoking"
  | "readiness-not-ready"
  | "conformance-failed"
  | "acknowledgement-required"
  | "tuple-changed"
  | "budget-exhausted"
  | "adapter-unavailable"
  | "lease-denied";

/**
 * The one sentence every surface uses when the admitted tuple cannot produce
 * structured review output: the free fast-fail at admission and the terminal
 * message a schema-failed review reports.
 */
export const STRUCTURED_OUTPUT_FAILURE_GUIDANCE =
  "This model could not produce Diffgazer's structured review output. Select a different model or update the configuration — reviews with this exact setup fail immediately until it changes. Verify can re-check it.";

export type AdmissionFailure = Readonly<{
  code: AdmissionFailureCode;
  safeMessage: string;
  retryable: boolean;
}>;

export type AdmissionSnapshot = Readonly<{
  configuration:
    | { readonly status: "supported"; readonly record: SupportedProviderConfigurationRecord }
    | { readonly status: "unknown" };
  binding: SecretBinding | null;
  evidence: AdmissionEvidence | null;
  credentialReferenceIdentity: string | null;
}>;

export type AdmittedExecutionPlan = Readonly<{
  configurationId: string;
  configurationRevision: number;
  executionFingerprint: string;
  evidenceKey: EvidenceKey;
  productId: RunnableProductId;
  transportFamily: "hosted-api";
  limits: ExecutionLimits;
}>;

export type ExecutionLease = Readonly<{
  leaseId: string;
  configurationId: string;
  configurationRevision: number;
  executionFingerprint: string;
  release: () => void;
}>;

export type AuthorizedReviewExecution = Readonly<{
  plan: AdmittedExecutionPlan;
  adapter: Adapter;
  /**
   * Whether stored evidence already proved this exact tuple can produce
   * structured review output. An `unproven` execution is the inline check, so
   * a completed review persists the proof the admission path did without.
   */
  evidenceState: "proven" | "unproven";
  /** The ledger this authorization reserved on; execution settles on the same one. */
  budgetLedger: BudgetLedger;
  budgetReservation: BudgetReservation;
  lease: ExecutionLease;
  resolveCredential: () => Promise<string | null>;
  release: () => void;
}>;

export type AdmissionServiceDependencies = Readonly<{
  now?: () => Date;
  loadSnapshot: (
    configurationId: string,
  ) => Promise<Result<AdmissionSnapshot | null, AdmissionFailure>>;
  leaseRegistry: ExecutionLeaseRegistry;
  createBudgetLedger: (limits: ExecutionLimits) => BudgetLedger;
  structuredOutputSchemaSha256: string;
  runtimeIdentity: RuntimeIdentity;
  resolveCredential: (input: {
    configurationId: string;
    configurationRevision: number;
    binding: SecretBinding | null;
  }) => Promise<string | null>;
  getAdapter?: (productId: string) => Adapter;
}>;

const CLIENT_FORBIDDEN_PLAN_KEYS = [
  "resolveCredential",
  "adapter",
  "binding",
  "secret",
  "apiKey",
  "credential",
  "filePath",
  "varName",
  "keyId",
  "reference",
] as const;

function hashExecutionFingerprintSync(input: {
  configurationId: string;
  configurationRevision: number;
  evidenceKey: EvidenceKey;
}): string {
  return sha256CanonicalJsonSync(ExecutionFingerprintInputSchema.parse(input));
}

/**
 * Reserves the whole admitted input envelope and the worst case the admitted
 * model can bill for it plus the planned answer length. The worst case is
 * reserved in full so a spend cap below it denies admission instead of
 * admitting a request it cannot cover.
 * Transports with no established price (local CLI and local HTTP, and any model
 * the bundled catalog does not price) bill nothing through this ledger and
 * reserve nothing; the token and byte caps remain their bound.
 */
function conservativeAttemptEstimate(
  limits: ExecutionLimits,
  productId: RunnableProductId,
  modelId: string,
): AttemptEstimate {
  return {
    inputTokens: limits.maxInputTokens,
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: estimateWorstCaseCostUsd(productId, modelId, limits) ?? 0,
  };
}

function admissionFailure(
  code: AdmissionFailureCode,
  safeMessage: string,
  retryable = false,
): AdmissionFailure {
  return { code, safeMessage, retryable };
}

function freezeAdmittedPlan(plan: AdmittedExecutionPlan): AdmittedExecutionPlan {
  return Object.freeze({
    ...plan,
    evidenceKey: Object.freeze({
      ...plan.evidenceKey,
      runtime: Object.freeze({ ...plan.evidenceKey.runtime }),
      limits: Object.freeze({ ...plan.evidenceKey.limits }),
    }),
    limits: Object.freeze({ ...plan.limits }),
  });
}

export function toClientSafeAdmittedPlanJson(plan: AdmittedExecutionPlan): string {
  return JSON.stringify({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    executionFingerprint: plan.executionFingerprint,
    productId: plan.productId,
    transportFamily: plan.transportFamily,
    modelId: plan.evidenceKey.modelId,
    limits: plan.limits,
    evidenceKeyHash: sha256CanonicalJsonSync(plan.evidenceKey),
  });
}

function collectStructuralKeys(value: unknown, keys: Set<string>): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStructuralKeys(item, keys);
    }
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectStructuralKeys(nested, keys);
  }
}

export function assertClientSafeAdmittedPlanSurface(plan: AdmittedExecutionPlan): void {
  const clientSurface = JSON.parse(toClientSafeAdmittedPlanJson(plan)) as unknown;
  const keys = new Set<string>();
  collectStructuralKeys(clientSurface, keys);
  for (const key of CLIENT_FORBIDDEN_PLAN_KEYS) {
    if (keys.has(key)) {
      throw new Error(`Admitted plan client surface must not include ${key}`);
    }
  }
}

export type ConfigurationLeaseIdentity = Readonly<{
  configurationId: string;
  configurationRevision: number;
  executionFingerprint: string;
}>;

export type ConfigurationLeaseFilter = Readonly<{
  configurationRevision?: number;
  executionFingerprint?: string;
}>;

interface ActiveLease {
  identity: ConfigurationLeaseIdentity;
  cancel: (() => void) | null;
}

const DEFAULT_DRAIN_TIMEOUT_MS = 30_000;

function identityMatchesFilter(
  identity: ConfigurationLeaseIdentity,
  filter: ConfigurationLeaseFilter | undefined,
): boolean {
  if (!filter) return true;
  if (
    filter.configurationRevision !== undefined &&
    identity.configurationRevision !== filter.configurationRevision
  ) {
    return false;
  }
  if (
    filter.executionFingerprint &&
    identity.executionFingerprint !== filter.executionFingerprint
  ) {
    return false;
  }
  return true;
}

/**
 * The single configuration-lease authority. It serves admission (capacity and
 * identity gating), session activation (cancellation callbacks attached to the
 * admitted lease), revocation, drain, and release. Deletion drains against the
 * same leases admission handed out, so credentials are never removed while an
 * admitted execution still holds one.
 */
export class ExecutionLeaseRegistry {
  private readonly revoked = new Set<string>();
  private readonly active = new Map<string, Map<string, ActiveLease>>();
  private readonly drainWaiters = new Map<string, Set<() => void>>();
  private nextLeaseSequence = 1;

  revoke(configurationId: string): void {
    this.revoked.add(configurationId);
  }

  clearRevocation(configurationId: string): void {
    this.revoked.delete(configurationId);
  }

  isRevoked(configurationId: string): boolean {
    return this.revoked.has(configurationId);
  }

  tryAcquire(
    input: ConfigurationLeaseIdentity & { limits: ExecutionLimits },
  ): Result<ExecutionLease, AdmissionFailure> {
    if (this.revoked.has(input.configurationId)) {
      return err(
        admissionFailure(
          "configuration-revoking",
          "Configuration is revoking and cannot admit new execution",
        ),
      );
    }

    const leases = this.active.get(input.configurationId) ?? new Map<string, ActiveLease>();

    if (leases.size >= input.limits.maxConcurrency) {
      return err(
        admissionFailure(
          "lease-denied",
          "Configuration already runs its maximum number of concurrent executions",
          true,
        ),
      );
    }

    for (const lease of leases.values()) {
      if (
        lease.identity.configurationRevision === input.configurationRevision &&
        lease.identity.executionFingerprint === input.executionFingerprint
      ) {
        return err(
          admissionFailure("lease-denied", "An identical execution is already in flight", true),
        );
      }
    }

    const identity: ConfigurationLeaseIdentity = Object.freeze({
      configurationId: input.configurationId,
      configurationRevision: input.configurationRevision,
      executionFingerprint: input.executionFingerprint,
    });
    const leaseId = `${identity.configurationId}:${identity.configurationRevision}:${identity.executionFingerprint}:${this.nextLeaseSequence++}`;
    leases.set(leaseId, { identity, cancel: null });
    this.active.set(identity.configurationId, leases);

    return ok(
      Object.freeze({
        leaseId,
        ...identity,
        release: () => {
          this.release(identity.configurationId, leaseId);
        },
      }),
    );
  }

  /**
   * Binds the owning session's cancellation to an already-admitted lease so
   * revocation reaches live work without creating a second lease.
   */
  attachCancel(configurationId: string, leaseId: string, cancel: () => void): void {
    const lease = this.active.get(configurationId)?.get(leaseId);
    if (lease) lease.cancel = cancel;
  }

  detachCancel(configurationId: string, leaseId: string): void {
    const lease = this.active.get(configurationId)?.get(leaseId);
    if (lease) lease.cancel = null;
  }

  cancel(configurationId: string, filter?: ConfigurationLeaseFilter): void {
    const leases = this.active.get(configurationId);
    if (!leases) return;
    for (const lease of [...leases.values()]) {
      if (!identityMatchesFilter(lease.identity, filter)) continue;
      lease.cancel?.();
    }
  }

  drain(
    configurationId: string,
    options?: { timeoutMs?: number },
  ): Promise<"drained" | "timed-out"> {
    if (this.activeLeaseCount(configurationId) === 0) return Promise.resolve("drained");

    const waiters = this.drainWaiters.get(configurationId) ?? new Set<() => void>();
    this.drainWaiters.set(configurationId, waiters);

    return new Promise((resolve) => {
      const onDrained = () => {
        clearTimeout(timer);
        resolve("drained");
      };
      const timer = setTimeout(() => {
        waiters.delete(onDrained);
        resolve("timed-out");
      }, options?.timeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS);
      timer.unref?.();
      waiters.add(onDrained);
    });
  }

  activeLeaseCount(configurationId: string): number {
    return this.active.get(configurationId)?.size ?? 0;
  }

  reset(): void {
    this.revoked.clear();
    this.active.clear();
    // Clearing the waiters without calling them orphans every in-flight
    // `drain()`: `release()` can no longer reach them, so they hang to their
    // timeout and then report "timed-out" for a registry that holds nothing.
    const waiterSets = [...this.drainWaiters.values()];
    this.drainWaiters.clear();
    for (const waiters of waiterSets) {
      for (const waiter of waiters) waiter();
    }
  }

  private release(configurationId: string, leaseId: string): void {
    const leases = this.active.get(configurationId);
    if (!leases?.delete(leaseId)) return;
    if (leases.size > 0) return;
    this.active.delete(configurationId);
    const waiters = this.drainWaiters.get(configurationId);
    if (!waiters) return;
    this.drainWaiters.delete(configurationId);
    for (const waiter of waiters) waiter();
  }
}

export async function authorizeReviewExecution(
  configurationId: string,
  dependencies: AdmissionServiceDependencies,
): Promise<Result<AuthorizedReviewExecution, AdmissionFailure>> {
  const loaded = await dependencies.loadSnapshot(configurationId);
  if (!loaded.ok) return loaded;
  const snapshot = loaded.value;
  if (!snapshot) {
    return err(admissionFailure("configuration-not-found", "Configuration was not found", false));
  }

  if (snapshot.configuration.status === "unknown") {
    return err(
      admissionFailure("configuration-unsupported", "Configuration is not supported", false),
    );
  }

  if (dependencies.leaseRegistry.isRevoked(configurationId)) {
    return err(
      admissionFailure(
        "configuration-revoking",
        "Configuration is revoking and cannot admit new execution",
      ),
    );
  }

  const record = snapshot.configuration.record;
  // An evidence key names the exact admitted model, so a configuration with no
  // selected model can never be admitted. Fail closed here instead of letting
  // the evidence-key parse throw out of a Result-returning boundary.
  const selectedModelId = record.selectedModelId;
  if (selectedModelId === null) {
    return err(
      admissionFailure("readiness-not-ready", "Configuration has no selected model", false),
    );
  }

  // The evidence key is parsed against the closed tuple contract, so a record
  // whose runtime identity does not belong to its product throws instead of
  // returning. Catch it here so this boundary keeps answering with a Result.
  let expectedEvidenceKey: EvidenceKey;
  try {
    expectedEvidenceKey = buildExpectedEvidenceKey({
      record,
      structuredOutputSchemaSha256: dependencies.structuredOutputSchemaSha256,
      runtime: dependencies.runtimeIdentity,
      credentialReferenceIdentity: snapshot.credentialReferenceIdentity,
    });
  } catch {
    return err(
      admissionFailure(
        "readiness-not-ready",
        "Configuration does not describe an admissible execution",
        false,
      ),
    );
  }

  const now = dependencies.now?.() ?? new Date();
  const readiness = computeProviderReadiness({
    configuration: record,
    binding: snapshot.binding,
    evidence: snapshot.evidence,
    runtime: dependencies.runtimeIdentity,
    structuredOutputSchemaSha256: dependencies.structuredOutputSchemaSha256,
    credentialReferenceIdentity: snapshot.credentialReferenceIdentity,
    now,
  });

  if (readiness.status === "acknowledgement-required") {
    return err(
      admissionFailure(
        "acknowledgement-required",
        "Provider acknowledgement is required before execution",
      ),
    );
  }

  if (!canAttemptReview(readiness.status)) {
    return err(
      admissionFailure("readiness-not-ready", "Configuration is not ready for execution", false),
    );
  }

  // Evidence caches what a review already observed about this exact tuple; it
  // is never a prerequisite. A matching failure is the only thing it can veto,
  // and it does so before any network call, reservation, or lease. Readiness
  // answered both questions one statement ago from the same record, evidence,
  // key and clock; re-deriving them here would only invite the two to diverge.
  if (
    readiness.status === "conformance-failed" ||
    readiness.status === "local-conformance-failed"
  ) {
    return err(admissionFailure("conformance-failed", STRUCTURED_OUTPUT_FAILURE_GUIDANCE, false));
  }
  const evidenceState = readiness.status === "ready" ? "proven" : "unproven";

  const reloaded = await dependencies.loadSnapshot(configurationId);
  if (!reloaded.ok) return reloaded;
  if (!reloaded.value) {
    return err(admissionFailure("configuration-not-found", "Configuration was not found", false));
  }
  // The store bumps the revision on every configuration mutation, credential
  // rebinds included, so the revision is the tuple's identity here.
  const reloadedConfiguration = reloaded.value.configuration;
  if (
    reloadedConfiguration.status !== "supported" ||
    reloadedConfiguration.record.revision !== record.revision
  ) {
    return err(
      admissionFailure("tuple-changed", "Configuration tuple changed during admission", false),
    );
  }

  if (snapshot.binding && snapshot.binding.kind !== "none") {
    if (!bindingCredentialAvailable(snapshot.binding)) {
      return err(
        admissionFailure("readiness-not-ready", "Configuration credential is unavailable", false),
      );
    }
    const resolvedCredential = await resolveSecretBinding(snapshot.binding, secretIO, {
      configurationId: record.configurationId,
      revision: record.revision,
    });
    if (!resolvedCredential) {
      return err(
        admissionFailure("readiness-not-ready", "Configuration credential is unavailable", false),
      );
    }
  }

  const resolveAdapter = dependencies.getAdapter ?? getAdapter;
  let adapter: Adapter;
  try {
    adapter = resolveAdapter(record.productId);
  } catch {
    return err(
      admissionFailure("adapter-unavailable", "No adapter is available for this product", false),
    );
  }

  if (adapter.productId !== record.productId) {
    return err(
      admissionFailure("adapter-unavailable", "Adapter route does not match configuration", false),
    );
  }

  const executionFingerprint = hashExecutionFingerprintSync({
    configurationId: record.configurationId,
    configurationRevision: record.revision,
    evidenceKey: expectedEvidenceKey,
  });

  const budgetLedger = dependencies.createBudgetLedger(expectedEvidenceKey.limits);
  const budgetReservation = budgetLedger.reserveAttempt(
    conservativeAttemptEstimate(expectedEvidenceKey.limits, record.productId, selectedModelId),
  );
  if (!budgetReservation.ok) {
    return err(admissionFailure("budget-exhausted", "Review budget is exhausted", false));
  }

  const leaseResult = dependencies.leaseRegistry.tryAcquire({
    configurationId: record.configurationId,
    configurationRevision: record.revision,
    executionFingerprint,
    limits: expectedEvidenceKey.limits,
  });
  if (!leaseResult.ok) {
    budgetLedger.releaseReservation(budgetReservation.value);
    return err(leaseResult.error);
  }

  const plan = freezeAdmittedPlan({
    configurationId: record.configurationId,
    configurationRevision: record.revision,
    executionFingerprint,
    evidenceKey: expectedEvidenceKey,
    productId: record.productId,
    transportFamily: record.transportFamily,
    limits: expectedEvidenceKey.limits,
  });
  assertClientSafeAdmittedPlanSurface(plan);

  // One release owner per authorization: the route holds it until session
  // creation transfers it, so releasing twice must not double-credit the ledger.
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    budgetLedger.releaseReservation(budgetReservation.value);
    leaseResult.value.release();
  };

  return ok(
    Object.freeze({
      plan,
      adapter,
      evidenceState,
      budgetLedger,
      budgetReservation: budgetReservation.value,
      lease: leaseResult.value,
      resolveCredential: () =>
        dependencies.resolveCredential({
          configurationId: record.configurationId,
          configurationRevision: record.revision,
          binding: snapshot.binding,
        }),
      release,
    }),
  );
}
