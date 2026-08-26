import { err, ok, type Result } from "@diffgazer/core/result";
import type { ExecutionLimits } from "@diffgazer/core/schemas/review";

/** Immutable admitted execution limits enforced by the per-review ledger. */
export type BudgetLimits = ExecutionLimits;

/** Which hard limit was exhausted. */
export type BudgetLimitKey = keyof BudgetLimits;

/** Conservative per-attempt reservation inputs supplied before dispatch. */
export type AttemptEstimate = {
  inputTokens: number;
  responseBytes: number;
  wallTimeMs: number;
  costUsd: number;
};

/**
 * Provider-reported usage settled after a terminal attempt. Dimensions the
 * provider did not report are absent and are never committed — the ledger
 * settles measured facts, never estimates derived from other dimensions.
 * Wall time is never settled: the review wall dimension is an elapsed
 * real-time clock, not a sum of dispatch durations.
 */
export type AttemptActual = {
  inputTokens: number;
  responseBytes?: number;
  costUsd?: number;
};

/** Elapsed review clock the wall dimension consults once attached. */
export type ReviewClock = {
  remainingMs(): number;
  expired(): boolean;
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
type BudgetCancelledOutcome = {
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

function emptyUsage(): UsageTotals {
  return {
    inputTokens: 0,
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
  assertNonNegativeInteger(estimate.responseBytes, "responseBytes");
  assertNonNegativeInteger(estimate.wallTimeMs, "wallTimeMs");
  assertFiniteNonNegative(estimate.costUsd, "costUsd");
}

/** Unreported dimensions settle as zero; they are never inferred from usage. */
function settledUsage(actual: AttemptActual): AttemptEstimate {
  return {
    inputTokens: actual.inputTokens,
    responseBytes: actual.responseBytes ?? 0,
    wallTimeMs: 0,
    costUsd: actual.costUsd ?? 0,
  };
}

function addUsage(target: UsageTotals, delta: AttemptEstimate) {
  target.inputTokens += delta.inputTokens;
  target.responseBytes += delta.responseBytes;
  target.wallTimeMs += delta.wallTimeMs;
  target.costUsd += delta.costUsd;
}

const COST_TOLERANCE_USD = 1e-9;

/** The part of an open reservation that settled usage actually consumes. */
function drawDown(remaining: AttemptEstimate, settled: AttemptEstimate): AttemptEstimate {
  return {
    inputTokens: Math.min(remaining.inputTokens, settled.inputTokens),
    responseBytes: Math.min(remaining.responseBytes, settled.responseBytes),
    wallTimeMs: Math.min(remaining.wallTimeMs, settled.wallTimeMs),
    costUsd: Math.min(remaining.costUsd, settled.costUsd),
  };
}

function subtractUsage(target: UsageTotals, delta: AttemptEstimate) {
  target.inputTokens -= delta.inputTokens;
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

export function createBudgetLedger(limits: BudgetLimits): BudgetLedger {
  return new BudgetLedger(limits);
}

type ReservationRecord = {
  estimate: AttemptEstimate;
};

export class BudgetLedger {
  private currentLimits: BudgetLimits;

  private readonly committed: UsageTotals = emptyUsage();
  private readonly reserved: UsageTotals = emptyUsage();
  private readonly reservations = new Map<number, ReservationRecord>();
  private nextReservationId = 1;
  private settledAttempts = 0;
  private exhaustedLimit: BudgetLimitKey | null = null;
  private cancelled = false;
  private reviewClock: { clock: ReviewClock; minimumDispatchMs: number } | null = null;

  constructor(limits: BudgetLimits) {
    this.currentLimits = Object.freeze({ ...limits });
  }

  get limits(): BudgetLimits {
    return this.currentLimits;
  }

  /**
   * Raises the envelope this review is allowed to spend and grows the standing
   * reservation to match. A diff the size gate split into batches costs a
   * multiple of the envelope admission projected for one call per lens, so
   * without this the review the gate just admitted would exhaust its budget
   * partway through and report the remaining lenses as failures. It moves once,
   * before the first dispatch, and only upwards; the admitted plan's own limits
   * are left alone because they are part of the execution fingerprint.
   *
   * `maxCostUsd` is never raised here. It is the user's per-review spend cap,
   * and a batched plan that cannot fit under it is refused before the first
   * dispatch rather than admitted and stopped halfway.
   */
  raiseReviewEnvelope(
    reservation: BudgetReservation,
    raised: Readonly<{ inputTokens: number; responseBytes: number; wallTimeMs: number }>,
  ): void {
    const record = this.reservations.get(reservation.id);
    if (!record) return;

    const inputTokens = Math.max(raised.inputTokens, this.currentLimits.maxInputTokens);
    const responseBytes = Math.max(raised.responseBytes, this.currentLimits.maxResponseBytes);
    const wallTimeMs = Math.max(raised.wallTimeMs, this.currentLimits.wallTimeMs);
    if (
      inputTokens === this.currentLimits.maxInputTokens &&
      responseBytes === this.currentLimits.maxResponseBytes &&
      wallTimeMs === this.currentLimits.wallTimeMs
    ) {
      return;
    }

    this.currentLimits = Object.freeze({
      ...this.currentLimits,
      maxInputTokens: inputTokens,
      maxResponseBytes: responseBytes,
      wallTimeMs,
    });
    this.reserved.inputTokens += inputTokens - record.estimate.inputTokens;
    this.reserved.responseBytes += responseBytes - record.estimate.responseBytes;
    this.reserved.wallTimeMs += wallTimeMs - record.estimate.wallTimeMs;
    record.estimate.inputTokens = inputTokens;
    record.estimate.responseBytes = responseBytes;
    record.estimate.wallTimeMs = wallTimeMs;
  }

  /**
   * Attaches the review's elapsed clock. From then on the wall dimension is
   * enforced at reserve time only: a dispatch that cannot fit at least
   * `minimumDispatchMs` in the remaining clock is refused, not started. The
   * ledger never owns a timer, so a fake clock keeps it synchronous in tests.
   */
  attachReviewClock(clock: ReviewClock, minimumDispatchMs: number): void {
    this.reviewClock = { clock, minimumDispatchMs };
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

    const usageExhaustion = this.checkReviewClock() ?? this.checkUsageBudget(estimate);
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
   * Commits provider-reported usage for one review dispatch and draws it down
   * from the still-open per-review reservation. The reservation stays open so
   * every later lens spends the same admitted envelope: once a dimension's
   * remaining envelope is gone, the next dispatch exhausts the review.
   */
  commitAttemptUsage(
    reservation: BudgetReservation,
    actual: AttemptActual,
  ): Result<void, BudgetExhaustedOutcome> {
    const settled = settledUsage(actual);
    validateEstimate(settled);

    const record = this.reservations.get(reservation.id);
    if (!record) {
      return ok(undefined);
    }

    const consumed = drawDown(record.estimate, settled);
    subtractUsage(this.reserved, consumed);
    subtractUsage(record.estimate, consumed);

    const usageExhaustion = this.checkUsageBudget(settled);
    addUsage(this.committed, settled);
    this.settledAttempts += 1;
    if (usageExhaustion) {
      this.exhaustedLimit = usageExhaustion;
      return err(createExhausted(usageExhaustion));
    }

    return ok(undefined);
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
    addUsage(this.committed, settled);
    this.settledAttempts += 1;
    if (usageExhaustion) {
      this.exhaustedLimit = usageExhaustion;
      return err(createExhausted(usageExhaustion));
    }

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
      responseBytes:
        this.committed.responseBytes + this.reserved.responseBytes + delta.responseBytes,
      wallTimeMs: this.committed.wallTimeMs + this.reserved.wallTimeMs + delta.wallTimeMs,
      costUsd: this.committed.costUsd + this.reserved.costUsd + delta.costUsd,
    };
  }

  /** Reserve-time wall refusal against the attached elapsed clock. */
  private checkReviewClock(): BudgetLimitKey | null {
    if (!this.reviewClock) return null;
    const { clock, minimumDispatchMs } = this.reviewClock;
    if (clock.expired() || clock.remainingMs() < minimumDispatchMs) {
      return "wallTimeMs";
    }
    return null;
  }

  private checkUsageBudget(delta: AttemptEstimate): BudgetLimitKey | null {
    const projected = this.projectedUsage(delta);
    if (projected.inputTokens > this.limits.maxInputTokens) {
      return "maxInputTokens";
    }
    if (projected.responseBytes > this.limits.maxResponseBytes) {
      return "maxResponseBytes";
    }
    // Once the elapsed clock is attached it owns the wall dimension; summed
    // projections would double-count time the clock already measures.
    if (this.reviewClock === null && projected.wallTimeMs > this.limits.wallTimeMs) {
      return "wallTimeMs";
    }
    // Dollars are the only fractional dimension, so drawing a settled cost out
    // of a reserved envelope leaves float residue. The tolerance is nine orders
    // of magnitude below any meaningful spend cap and far above that residue.
    if (projected.costUsd > this.limits.maxCostUsd + COST_TOLERANCE_USD) {
      return "maxCostUsd";
    }
    return null;
  }
}
