import type { ExecutionLimits } from "@diffgazer/core/schemas/review";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelSessionsForProject,
  createConfigurationLeaseHooks,
  getConfigurationLeaseAuthority,
  registerSession,
  resetConfigurationLeaseRegistryForTests,
  unregisterSession,
} from "./session-registry.js";

const authority = getConfigurationLeaseAuthority();

const CONFIGURATION_ID = "cfg-gemini";
const OTHER_CONFIGURATION_ID = "cfg-openrouter";
const REVISION = 3;
const FINGERPRINT_A = "a".repeat(64);
const FINGERPRINT_B = "b".repeat(64);

const LIMITS: ExecutionLimits = {
  maxInputTokens: 100_000,
  maxResponseBytes: 4_000_000,
  wallTimeMs: 120_000,
  maxRetries: 0,
  maxConcurrency: 4,
  maxCostUsd: 1,
};

beforeEach(() => {
  resetConfigurationLeaseRegistryForTests();
  unregisterSession("session-a");
  unregisterSession("session-b");
  unregisterSession("session-c");
});

function acquire(
  options: {
    configurationId?: string;
    configurationRevision?: number;
    executionFingerprint?: string;
    limits?: ExecutionLimits;
  } = {},
) {
  const result = authority.tryAcquire({
    configurationId: options.configurationId ?? CONFIGURATION_ID,
    configurationRevision: options.configurationRevision ?? REVISION,
    executionFingerprint: options.executionFingerprint ?? FINGERPRINT_A,
    limits: options.limits ?? LIMITS,
  });
  if (!result.ok) throw new Error(`lease acquisition failed: ${result.error.code}`);
  return result.value;
}

function registerAdmittedSession(
  sessionId: string,
  options: {
    projectKey?: string;
    configurationId?: string;
    configurationRevision?: number;
    executionFingerprint?: string;
  } = {},
) {
  const lease = acquire(options);
  const cancel = vi.fn();
  registerSession(sessionId, {
    projectKey: options.projectKey ?? "/project",
    configurationId: lease.configurationId,
    configurationRevision: lease.configurationRevision,
    admittedExecutionFingerprint: lease.executionFingerprint,
    leaseId: lease.leaseId,
    cancel,
  });
  return { cancel, lease };
}

describe("configuration lease authority", () => {
  it("refuses new leases for a revoked configuration", () => {
    authority.revoke(CONFIGURATION_ID);

    expect(authority.isRevoked(CONFIGURATION_ID)).toBe(true);
    const result = authority.tryAcquire({
      configurationId: CONFIGURATION_ID,
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_A,
      limits: LIMITS,
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.code).toBe("configuration-revoking");
  });

  it("denies a second concurrent lease for an identical execution identity", () => {
    acquire();

    const second = authority.tryAcquire({
      configurationId: CONFIGURATION_ID,
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_A,
      limits: LIMITS,
    });

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error.code).toBe("lease-denied");
  });

  it("denies acquisition once the admitted concurrency limit is reached", () => {
    const limits: ExecutionLimits = { ...LIMITS, maxConcurrency: 1 };
    acquire({ limits });

    const second = authority.tryAcquire({
      configurationId: CONFIGURATION_ID,
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_B,
      limits,
    });

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error.code).toBe("lease-denied");
  });

  it("admits again after the holding lease releases", () => {
    const limits: ExecutionLimits = { ...LIMITS, maxConcurrency: 1 };
    const lease = acquire({ limits });
    lease.release();

    const second = authority.tryAcquire({
      configurationId: CONFIGURATION_ID,
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_A,
      limits,
    });

    expect(second.ok).toBe(true);
  });

  it("cancels only sessions matching the exact configuration tuple", () => {
    const exact = registerAdmittedSession("session-a", {
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_A,
    });
    const otherRevision = registerAdmittedSession("session-b", {
      configurationRevision: REVISION + 1,
      executionFingerprint: FINGERPRINT_A,
    });
    const otherFingerprint = registerAdmittedSession("session-c", {
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_B,
    });

    authority.cancel(CONFIGURATION_ID, {
      configurationRevision: REVISION,
      executionFingerprint: FINGERPRINT_A,
    });

    expect(exact.cancel).toHaveBeenCalledWith({
      configurationId: CONFIGURATION_ID,
      configurationRevision: REVISION,
      admittedExecutionFingerprint: FINGERPRINT_A,
    });
    expect(otherRevision.cancel).not.toHaveBeenCalled();
    expect(otherFingerprint.cancel).not.toHaveBeenCalled();
  });

  it("does not broadcast cancellation to unrelated configurations", () => {
    const target = registerAdmittedSession("session-a", { configurationId: CONFIGURATION_ID });
    const unrelated = registerAdmittedSession("session-b", {
      configurationId: OTHER_CONFIGURATION_ID,
    });

    authority.cancel(CONFIGURATION_ID);

    expect(target.cancel).toHaveBeenCalled();
    expect(unrelated.cancel).not.toHaveBeenCalled();
  });

  it("waits for active leases to release before reporting drain completion", async () => {
    const lease = acquire();

    const drainPromise = authority.drain(CONFIGURATION_ID);
    let settled = false;
    void drainPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    lease.release();
    await expect(drainPromise).resolves.toBe("drained");
  });

  it("times out truthfully when leases never release", async () => {
    acquire();

    await expect(authority.drain(CONFIGURATION_ID, { timeoutMs: 10 })).resolves.toBe("timed-out");
  });

  it("settles a waiting drain when the registry is reset out from under it", async () => {
    acquire();
    const drainPromise = authority.drain(CONFIGURATION_ID);

    resetConfigurationLeaseRegistryForTests();

    // The reset dropped every lease, so the drain is complete; leaving it to
    // its timeout would report "timed-out" for a registry holding nothing.
    await expect(drainPromise).resolves.toBe("drained");
  });

  it("cancels only the sessions registered under the requested project key", () => {
    const cancelMatching = vi.fn();
    const cancelOther = vi.fn();
    registerSession("session-a", { projectKey: "/project", cancel: cancelMatching });
    registerSession("session-b", { projectKey: "/other", cancel: cancelOther });

    cancelSessionsForProject("/project");

    expect(cancelMatching).toHaveBeenCalled();
    expect(cancelOther).not.toHaveBeenCalled();
  });
});

describe("configuration lease hooks", () => {
  it("lets configuration deletion commit only after the cancelled work drains", async () => {
    const events: string[] = [];
    const { cancel, lease } = registerAdmittedSession("session-a");
    const hooks = createConfigurationLeaseHooks();

    const deletePromise = (async () => {
      await hooks.revoke(CONFIGURATION_ID);
      events.push("revoke");
      await hooks.cancel(CONFIGURATION_ID);
      events.push("cancel");
      await hooks.drain(CONFIGURATION_ID);
      events.push("drain");
      events.push("delete");
    })();

    await vi.waitFor(() => expect(events).toContain("cancel"));
    expect(cancel).toHaveBeenCalled();
    expect(events).toEqual(["revoke", "cancel"]);

    lease.release();
    await deletePromise;
    expect(events).toEqual(["revoke", "cancel", "drain", "delete"]);
  });

  it("fails closed and clears revocation when the drain times out", async () => {
    vi.useFakeTimers();
    try {
      acquire();
      const hooks = createConfigurationLeaseHooks();
      hooks.revoke(CONFIGURATION_ID);

      const drained = hooks.drain(CONFIGURATION_ID);
      const assertion = expect(drained).rejects.toThrow(/active executions/);
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(authority.isRevoked(CONFIGURATION_ID)).toBe(false);
  });
});
