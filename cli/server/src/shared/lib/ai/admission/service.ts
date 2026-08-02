import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { RunnableProductId, TransportFamily } from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  EvidenceKeySchema,
  ExecutionFingerprintInputSchema,
  type ExecutionLimits,
  type RuntimeIdentity,
  sha256CanonicalJsonSync,
} from "@diffgazer/core/schemas/review";
import {
  type AdmissionEvidence,
  canAuthorizeEvidence,
  evidenceMatchesKey,
} from "../../config/admission-evidence.js";
import type {
  ConfigurationBudgetLimits,
  RemovedProviderConfigurationRecord,
  SupportedProviderConfigurationRecord,
} from "../../config/provider-config.js";
import { computeProviderReadiness } from "../../config/readiness.js";
import type { SecretBinding } from "../../config/secret-bindings.js";
import {
  type AttemptEstimate,
  type BudgetLedger,
  type BudgetReservation,
  ZERO_FINDINGS,
} from "../budget/ledger.js";
import { type Adapter, getAdapter } from "../providers/registry.js";

export type AdmissionFailureCode =
  | "configuration-not-found"
  | "configuration-unsupported"
  | "configuration-removed"
  | "configuration-revoking"
  | "readiness-not-ready"
  | "evidence-missing"
  | "evidence-skipped"
  | "evidence-stale"
  | "evidence-hash-mismatch"
  | "acknowledgement-required"
  | "tuple-changed"
  | "budget-exhausted"
  | "adapter-unavailable"
  | "lease-denied";

export type AdmissionFailure = Readonly<{
  code: AdmissionFailureCode;
  safeMessage: string;
  retryable: boolean;
}>;

export type AdmissionSnapshot = Readonly<{
  configuration:
    | { readonly status: "supported"; readonly record: SupportedProviderConfigurationRecord }
    | { readonly status: "removed"; readonly record: RemovedProviderConfigurationRecord }
    | { readonly status: "unknown" };
  binding: SecretBinding | null;
  evidence: AdmissionEvidence | null;
  credentialReferenceIdentity: string | null;
  workspaceAccountReference: string | null;
}>;

export type AdmittedExecutionPlan = Readonly<{
  configurationId: string;
  configurationRevision: number;
  executionFingerprint: string;
  evidenceKey: EvidenceKey;
  productId: RunnableProductId;
  transportFamily: TransportFamily;
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
  /** The ledger this authorization reserved on; execution settles on the same one. */
  budgetLedger: BudgetLedger;
  budgetReservation: BudgetReservation;
  lease: ExecutionLease;
  resolveCredential: () => Promise<string | null>;
  /**
   * The workspace account the configuration is bound to, for the products whose
   * endpoint is workspace-bound. The plan carries only its hashed reference, so
   * the literal travels on the server-only execution channel.
   */
  workspaceAccountId: string | null;
  release: () => void;
}>;

export type AdmissionServiceDependencies = Readonly<{
  now?: () => Date;
  loadSnapshot: (configurationId: string) => Promise<AdmissionSnapshot | null>;
  leaseRegistry: ExecutionLeaseRegistry;
  budgetLedger: BudgetLedger;
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

export function executionLimitsFromBudget(budget: ConfigurationBudgetLimits): ExecutionLimits {
  return Object.freeze({
    maxInputTokens: budget.inputTokens,
    maxOutputTokens: budget.outputTokens,
    maxResponseBytes: budget.responseBytes,
    wallTimeMs: budget.wallTimeMs,
    maxRetries: budget.retries,
    maxConcurrency: budget.concurrency,
    maxCostUsd: budget.perReview,
  });
}

export function buildExpectedEvidenceKey(input: {
  readonly record: SupportedProviderConfigurationRecord;
  readonly structuredOutputSchemaSha256: string;
  readonly runtime: RuntimeIdentity;
  readonly credentialReferenceIdentity: string | null;
  readonly workspaceAccountReference: string | null;
}): EvidenceKey {
  const { record } = input;
  const product = PRODUCT_REGISTRY[record.productId];
  const expectedEndpoint =
    record.input.transportFamily === "local-cli" ? null : record.input.endpoint;
  const expectedRegion =
    record.input.transportFamily === "hosted-api" ? (record.input.region ?? null) : null;

  const authentication =
    record.input.transportFamily === "local-http" ? record.input.authentication : null;
  const installationId =
    record.input.transportFamily === "local-cli" ? record.input.installationId : null;

  return EvidenceKeySchema.parse({
    authentication,
    credentialReferenceIdentity: input.credentialReferenceIdentity,
    installationId,
    productId: record.productId,
    transportFamily: record.transportFamily,
    normalizedEndpoint: expectedEndpoint,
    region: expectedRegion,
    workspaceAccountReference: input.workspaceAccountReference,
    modelId: record.selectedModelId,
    runtime: input.runtime,
    structuredOutputSchemaSha256: input.structuredOutputSchemaSha256,
    noticeVersion: product.notice.noticeVersion,
    limits: executionLimitsFromBudget(record.budget),
  });
}

function hashExecutionFingerprintSync(input: {
  configurationId: string;
  configurationRevision: number;
  evidenceKey: EvidenceKey;
}): string {
  return sha256CanonicalJsonSync(ExecutionFingerprintInputSchema.parse(input));
}

function conservativeAttemptEstimate(limits: ExecutionLimits): AttemptEstimate {
  return {
    inputTokens: limits.maxInputTokens,
    outputTokens: limits.maxOutputTokens,
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: limits.maxCostUsd,
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
    this.drainWaiters.clear();
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
  const snapshot = await dependencies.loadSnapshot(configurationId);
  if (!snapshot) {
    return err(admissionFailure("configuration-not-found", "Configuration was not found", false));
  }

  if (snapshot.configuration.status === "unknown") {
    return err(
      admissionFailure("configuration-unsupported", "Configuration is not supported", false),
    );
  }

  if (snapshot.configuration.status === "removed") {
    return err(admissionFailure("configuration-removed", "Configuration has been removed", false));
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
  const expectedEvidenceKey = buildExpectedEvidenceKey({
    record,
    structuredOutputSchemaSha256: dependencies.structuredOutputSchemaSha256,
    runtime: dependencies.runtimeIdentity,
    credentialReferenceIdentity: snapshot.credentialReferenceIdentity,
    workspaceAccountReference: snapshot.workspaceAccountReference,
  });

  const readiness = computeProviderReadiness({
    configuration: record,
    binding: snapshot.binding,
    evidence: snapshot.evidence,
    evidenceKey: expectedEvidenceKey,
    credentialReferenceIdentity: snapshot.credentialReferenceIdentity,
    workspaceAccountReference: snapshot.workspaceAccountReference,
    now: dependencies.now?.() ?? new Date(),
  });

  if (readiness.status === "acknowledgement-required") {
    return err(
      admissionFailure(
        "acknowledgement-required",
        "Provider acknowledgement is required before execution",
      ),
    );
  }

  if (!snapshot.evidence) {
    return err(admissionFailure("evidence-missing", "Admission evidence is missing", false));
  }

  if (snapshot.evidence.status === "skipped") {
    return err(admissionFailure("evidence-skipped", "Admission evidence was skipped", false));
  }

  if (!evidenceMatchesKey(snapshot.evidence, expectedEvidenceKey)) {
    const storedKeyHash = sha256CanonicalJsonSync(snapshot.evidence.evidenceKey);
    const expectedKeyHash = sha256CanonicalJsonSync(expectedEvidenceKey);
    return err(
      admissionFailure(
        storedKeyHash !== expectedKeyHash ? "tuple-changed" : "evidence-hash-mismatch",
        storedKeyHash !== expectedKeyHash
          ? "Configuration tuple changed since admission evidence was recorded"
          : "Admission evidence does not match the current configuration tuple",
        false,
      ),
    );
  }

  if (
    snapshot.evidence.status !== "passed" ||
    !canAuthorizeEvidence(snapshot.evidence, expectedEvidenceKey, {
      now: dependencies.now?.() ?? new Date(),
    })
  ) {
    return err(admissionFailure("evidence-stale", "Admission evidence is stale or expired", false));
  }

  if (readiness.status !== "ready") {
    return err(
      admissionFailure("readiness-not-ready", "Configuration is not ready for execution", false),
    );
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

  const budgetReservation = dependencies.budgetLedger.reserveAttempt(
    conservativeAttemptEstimate(expectedEvidenceKey.limits),
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
    dependencies.budgetLedger.releaseReservation(budgetReservation.value);
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
    dependencies.budgetLedger.releaseReservation(budgetReservation.value);
    leaseResult.value.release();
  };

  return ok(
    Object.freeze({
      plan,
      adapter,
      budgetLedger: dependencies.budgetLedger,
      budgetReservation: budgetReservation.value,
      lease: leaseResult.value,
      resolveCredential: () =>
        dependencies.resolveCredential({
          configurationId: record.configurationId,
          configurationRevision: record.revision,
          binding: snapshot.binding,
        }),
      workspaceAccountId:
        record.input.transportFamily === "hosted-api" ? (record.input.workspace ?? null) : null,
      release,
    }),
  );
}

export const ADMISSION_ZERO_FINDINGS = ZERO_FINDINGS;
