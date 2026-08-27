import { err, ok, type Result } from "@diffgazer/core/result";
import type { ExecutionLimits } from "@diffgazer/core/schemas/review";
import { type AdmissionFailure, admissionFailure } from "./failure.js";

export type ExecutionLease = Readonly<{
  leaseId: string;
  configurationId: string;
  configurationRevision: number;
  executionFingerprint: string;
  release: () => void;
}>;

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
