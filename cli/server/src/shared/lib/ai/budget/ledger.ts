import { err, ok, type Result } from "@diffgazer/core/result";
import type { ExecutionLimits } from "@diffgazer/core/schemas/review";

/** Immutable admitted execution limits enforced by the per-review ledger. */
export type BudgetLimits = ExecutionLimits;

/** Which hard limit was exhausted. Keys match {@link ExecutionLimits}. */
export type BudgetLimitKey = keyof BudgetLimits;

/** Conservative per-attempt reservation inputs supplied before dispatch. */
export type AttemptEstimate = {
  inputTokens: number;
  outputTokens: number;
  responseBytes: number;
  wallTimeMs: number;
  costUsd: number;
};

/**
 * Provider-reported usage settled after a terminal attempt. Dimensions the
 * provider did not report are absent and are never committed — the ledger
 * settles measured facts, never estimates derived from other dimensions.
 */
export type AttemptActual = {
  inputTokens: number;
  outputTokens: number;
  wallTimeMs: number;
  responseBytes?: number;
  costUsd?: number;
};

/** Zero findings returned for every non-completed terminal outcome. */
export const ZERO_FINDINGS = { issues: [] as const };

/** Terminal budget failure surfaced to execution finalization. */
export type BudgetExhaustedOutcome = {
  outcome: "budget-exhausted";
  limit: BudgetLimitKey;
  result: typeof ZERO_FINDINGS;
};

/** Ledger cancellation surfaced when reserve is attempted after cancel(). */
export type BudgetCancelledOutcome = {
  outcome: "cancelled";
  result: typeof ZERO_FINDINGS;
};

export type BudgetReserveError = BudgetExhaustedOutcome | BudgetCancelledOutcome;

/** Opaque reservation returned from a successful reserve call. */
export type BudgetReservation = {
  readonly id: number;
};

/** Committed and in-flight totals for presentation and admission checks. */
export type BudgetSnapshot = {
  limits: BudgetLimits;
  committed: AttemptEstimate;
  reserved: AttemptEstimate;
  inFlightAttempts: number;
  settledAttempts: number;
  exhaustedLimit: BudgetLimitKey | null;
  cancelled: boolean;
};

type UsageTotals = AttemptEstimate;

const LIMIT_KEYS = [
  "maxInputTokens",
  "maxOutputTokens",
  "maxResponseBytes",
  "wallTimeMs",
  "maxRetries",
  "maxConcurrency",
  "maxCostUsd",
] as const satisfies readonly BudgetLimitKey[];

function emptyUsage(): UsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    responseBytes: 0,
    wallTimeMs: 0,
    costUsd: 0,
  };
}

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
}

function validateEstimate(estimate: AttemptEstimate) {
  assertNonNegativeInteger(estimate.inputTokens, "inputTokens");
  assertNonNegativeInteger(estimate.outputTokens, "outputTokens");
  assertNonNegativeInteger(estimate.responseBytes, "responseBytes");
  assertNonNegativeInteger(estimate.wallTimeMs, "wallTimeMs");
  assertFiniteNonNegative(estimate.costUsd, "costUsd");
}

/** Unreported dimensions settle as zero; they are never inferred from usage. */
function settledUsage(actual: AttemptActual): AttemptEstimate {
  return {
    inputTokens: actual.inputTokens,
    outputTokens: actual.outputTokens,
    responseBytes: actual.responseBytes ?? 0,
    wallTimeMs: actual.wallTimeMs,
    costUsd: actual.costUsd ?? 0,
  };
}

function addUsage(target: UsageTotals, delta: AttemptEstimate) {
  target.inputTokens += delta.inputTokens;
  target.outputTokens += delta.outputTokens;
  target.responseBytes += delta.responseBytes;
  target.wallTimeMs += delta.wallTimeMs;
  target.costUsd += delta.costUsd;
}

function subtractUsage(target: UsageTotals, delta: AttemptEstimate) {
  target.inputTokens -= delta.inputTokens;
  target.outputTokens -= delta.outputTokens;
  target.responseBytes -= delta.responseBytes;
  target.wallTimeMs -= delta.wallTimeMs;
  target.costUsd -= delta.costUsd;
}

function createExhausted(limit: BudgetLimitKey): BudgetExhaustedOutcome {
  return {
    outcome: "budget-exhausted",
    limit,
    result: ZERO_FINDINGS,
  };
}

/**
 * Provider-advertised maxima may only reduce a configured local cap; they never
 * widen Diffgazer's admitted execution limits.
 */
export function effectiveExecutionLimits(
  localLimits: BudgetLimits,
  providerLimits?: Partial<BudgetLimits>,
): BudgetLimits {
  if (!providerLimits) {
    return localLimits;
  }

  const effective = { ...localLimits };
  for (const key of LIMIT_KEYS) {
    const providerValue = providerLimits[key];
    if (providerValue === undefined) {
      continue;
    }
    effective[key] = Math.min(localLimits[key], providerValue) as BudgetLimits[typeof key];
  }
  return effective;
}

export function createBudgetLedger(limits: BudgetLimits): BudgetLedger {
  return new BudgetLedger(limits);
}

type ReservationRecord = {
  estimate: AttemptEstimate;
};

export class BudgetLedger {
  readonly limits: BudgetLimits;

  private readonly committed: UsageTotals = emptyUsage();
  private readonly reserved: UsageTotals = emptyUsage();
  private readonly reservations = new Map<number, ReservationRecord>();
  private nextReservationId = 1;
  private settledAttempts = 0;
  private exhaustedLimit: BudgetLimitKey | null = null;
  private cancelled = false;

  constructor(limits: BudgetLimits) {
    this.limits = Object.freeze({ ...limits });
  }

  snapshot(): BudgetSnapshot {
    return {
      limits: this.limits,
      committed: { ...this.committed },
      reserved: { ...this.reserved },
      inFlightAttempts: this.reservations.size,
      settledAttempts: this.settledAttempts,
      exhaustedLimit: this.exhaustedLimit,
      cancelled: this.cancelled,
    };
  }

  /**
   * Atomically reserves attempt, retry, concurrency, and conservative usage
   * budgets before adapter dispatch.
   */
  reserveAttempt(estimate: AttemptEstimate): Result<BudgetReservation, BudgetReserveError> {
    validateEstimate(estimate);

    if (this.cancelled) {
      return err({ outcome: "cancelled", result: ZERO_FINDINGS });
    }
    if (this.exhaustedLimit) {
      return err(createExhausted(this.exhaustedLimit));
    }

    const attemptExhaustion = this.checkAttemptBudget();
    if (attemptExhaustion === "maxConcurrency") {
      return err(createExhausted("maxConcurrency"));
    }
    if (attemptExhaustion) {
      this.exhaustedLimit = attemptExhaustion;
      return err(createExhausted(attemptExhaustion));
    }

    const usageExhaustion = this.checkUsageBudget(estimate);
    if (usageExhaustion) {
      this.exhaustedLimit = usageExhaustion;
      return err(createExhausted(usageExhaustion));
    }

    const id = this.nextReservationId++;
    this.reservations.set(id, { estimate: { ...estimate } });
    addUsage(this.reserved, estimate);
    return ok({ id });
  }

  /** Releases an un-settled reservation, for example on cancellation or timeout. */
  releaseReservation(reservation: BudgetReservation): void {
    const record = this.reservations.get(reservation.id);
    if (!record) {
      return;
    }
    subtractUsage(this.reserved, record.estimate);
    this.reservations.delete(reservation.id);
  }

  /**
   * Commits provider-reported usage for a completed attempt and releases the
   * conservative reservation.
   */
  settleAttempt(
    reservation: BudgetReservation,
    actual: AttemptActual,
  ): Result<void, BudgetExhaustedOutcome> {
    const settled = settledUsage(actual);
    validateEstimate(settled);

    const record = this.reservations.get(reservation.id);
    if (!record) {
      return ok(undefined);
    }

    subtractUsage(this.reserved, record.estimate);
    this.reservations.delete(reservation.id);

    const usageExhaustion = this.checkUsageBudget(settled);
    if (usageExhaustion) {
      this.exhaustedLimit = usageExhaustion;
      return err(createExhausted(usageExhaustion));
    }

    addUsage(this.committed, settled);
    this.settledAttempts += 1;
    return ok(undefined);
  }

  /** Releases every in-flight reservation without committing usage. */
  cancel(): void {
    this.cancelled = true;
    for (const [id, record] of this.reservations) {
      subtractUsage(this.reserved, record.estimate);
      this.reservations.delete(id);
    }
  }

  private checkAttemptBudget(): BudgetLimitKey | null {
    if (this.reservations.size >= this.limits.maxConcurrency) {
      return "maxConcurrency";
    }
    if (this.settledAttempts + this.reservations.size >= this.limits.maxRetries + 1) {
      return "maxRetries";
    }
    return null;
  }

  private projectedUsage(delta: AttemptEstimate): UsageTotals {
    return {
      inputTokens: this.committed.inputTokens + this.reserved.inputTokens + delta.inputTokens,
      outputTokens: this.committed.outputTokens + this.reserved.outputTokens + delta.outputTokens,
      responseBytes:
        this.committed.responseBytes + this.reserved.responseBytes + delta.responseBytes,
      wallTimeMs: this.committed.wallTimeMs + this.reserved.wallTimeMs + delta.wallTimeMs,
      costUsd: this.committed.costUsd + this.reserved.costUsd + delta.costUsd,
    };
  }

  private checkUsageBudget(delta: AttemptEstimate): BudgetLimitKey | null {
    const projected = this.projectedUsage(delta);
    if (projected.inputTokens > this.limits.maxInputTokens) {
      return "maxInputTokens";
    }
    if (projected.outputTokens > this.limits.maxOutputTokens) {
      return "maxOutputTokens";
    }
    if (projected.responseBytes > this.limits.maxResponseBytes) {
      return "maxResponseBytes";
    }
    if (projected.wallTimeMs > this.limits.wallTimeMs) {
      return "wallTimeMs";
    }
    if (projected.costUsd > this.limits.maxCostUsd) {
      return "maxCostUsd";
    }
    return null;
  }
}
