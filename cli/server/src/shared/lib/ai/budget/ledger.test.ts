import type { ExecutionLimits } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import {
  type AttemptEstimate,
  createBudgetLedger,
  effectiveExecutionLimits,
  ZERO_FINDINGS,
} from "./ledger.js";

function sampleLimits(overrides: Partial<ExecutionLimits> = {}): ExecutionLimits {
  return {
    maxInputTokens: 10_000,
    maxOutputTokens: 2_000,
    maxResponseBytes: 1_000_000,
    wallTimeMs: 60_000,
    maxRetries: 2,
    maxConcurrency: 2,
    maxCostUsd: 1,
    ...overrides,
  };
}

function estimate(overrides: Partial<AttemptEstimate> = {}): AttemptEstimate {
  return {
    inputTokens: 100,
    outputTokens: 50,
    responseBytes: 1_024,
    wallTimeMs: 1_000,
    costUsd: 0.01,
    ...overrides,
  };
}

describe("effectiveExecutionLimits", () => {
  it("provider limits cannot widen local limits", () => {
    const local = sampleLimits({
      maxInputTokens: 1_000,
      maxOutputTokens: 500,
      maxResponseBytes: 100_000,
      wallTimeMs: 30_000,
      maxRetries: 1,
      maxConcurrency: 2,
      maxCostUsd: 0.25,
    });

    const widened = effectiveExecutionLimits(local, {
      maxInputTokens: 2_000_000,
      maxOutputTokens: 500_000,
      maxResponseBytes: 50_000_000,
      wallTimeMs: 600_000,
      maxRetries: 10,
      maxConcurrency: 16,
      maxCostUsd: 50,
    });

    expect(widened).toEqual(local);
  });

  it("provider limits may only reduce configured local caps", () => {
    const local = sampleLimits({ maxInputTokens: 10_000, maxOutputTokens: 2_000 });

    expect(
      effectiveExecutionLimits(local, {
        maxInputTokens: 4_000,
        maxOutputTokens: 8_000,
      }),
    ).toEqual({
      ...local,
      maxInputTokens: 4_000,
      maxOutputTokens: 2_000,
    });
  });
});

describe("BudgetLedger concurrency", () => {
  it("does not over-reserve concurrency slots beyond maxConcurrency", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxConcurrency: 2, maxRetries: 10 }));

    const first = ledger.reserveAttempt(estimate());
    const second = ledger.reserveAttempt(estimate());
    const third = ledger.reserveAttempt(estimate());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.error).toEqual({
        outcome: "budget-exhausted",
        limit: "maxConcurrency",
        result: ZERO_FINDINGS,
      });
    }
    expect(ledger.snapshot().inFlightAttempts).toBe(2);
  });

  it("releases a concurrency slot after cancellation so a later attempt can reserve", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxConcurrency: 1, maxRetries: 3 }));

    const first = ledger.reserveAttempt(estimate());
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const blocked = ledger.reserveAttempt(estimate());
    expect(blocked.ok).toBe(false);

    ledger.releaseReservation(first.value);

    const afterRelease = ledger.reserveAttempt(estimate());
    expect(afterRelease.ok).toBe(true);
    expect(ledger.snapshot().inFlightAttempts).toBe(1);
  });
});

describe("BudgetLedger retries", () => {
  it("charges every retry against maxRetries", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxRetries: 1, maxConcurrency: 1 }));

    const initial = ledger.reserveAttempt(estimate());
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(ledger.settleAttempt(initial.value, estimate())).toMatchObject({ ok: true });

    const firstRetry = ledger.reserveAttempt(estimate());
    expect(firstRetry.ok).toBe(true);
    if (!firstRetry.ok) return;
    expect(ledger.settleAttempt(firstRetry.value, estimate())).toMatchObject({ ok: true });

    const secondRetry = ledger.reserveAttempt(estimate());
    expect(secondRetry.ok).toBe(false);
    if (!secondRetry.ok) {
      expect(secondRetry.error.outcome).toBe("budget-exhausted");
      if (secondRetry.error.outcome === "budget-exhausted") {
        expect(secondRetry.error.limit).toBe("maxRetries");
      }
      expect(secondRetry.error.result.issues).toEqual([]);
    }
    expect(ledger.snapshot().settledAttempts).toBe(2);
  });
});

describe("BudgetLedger cancellation", () => {
  it("releases reserved usage when an attempt is cancelled before settlement", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxInputTokens: 500, maxConcurrency: 1 }));

    const reserved = ledger.reserveAttempt(estimate({ inputTokens: 400 }));
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) return;

    ledger.releaseReservation(reserved.value);

    const again = ledger.reserveAttempt(estimate({ inputTokens: 400 }));
    expect(again.ok).toBe(true);
    expect(ledger.snapshot()).toMatchObject({
      committed: estimate({
        inputTokens: 0,
        outputTokens: 0,
        responseBytes: 0,
        wallTimeMs: 0,
        costUsd: 0,
      }),
      reserved: estimate({ inputTokens: 400 }),
      inFlightAttempts: 1,
      settledAttempts: 0,
    });
  });

  it("cancel releases every in-flight reservation without committing usage", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxConcurrency: 2 }));

    const first = ledger.reserveAttempt(estimate({ inputTokens: 200 }));
    const second = ledger.reserveAttempt(estimate({ inputTokens: 300 }));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    ledger.cancel();

    expect(ledger.snapshot()).toMatchObject({
      committed: emptyUsage(),
      reserved: emptyUsage(),
      inFlightAttempts: 0,
      cancelled: true,
    });

    const afterCancel = ledger.reserveAttempt(estimate());
    expect(afterCancel.ok).toBe(false);
    if (!afterCancel.ok) {
      expect(afterCancel.error).toEqual({
        outcome: "cancelled",
        result: ZERO_FINDINGS,
      });
    }
  });
});

describe("BudgetLedger exhaustion", () => {
  it("returns budget-exhausted with the exact input-token limit and zero findings", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxInputTokens: 250 }));

    const exhausted = ledger.reserveAttempt(estimate({ inputTokens: 300 }));
    expect(exhausted.ok).toBe(false);
    if (!exhausted.ok) {
      expect(exhausted.error).toEqual({
        outcome: "budget-exhausted",
        limit: "maxInputTokens",
        result: ZERO_FINDINGS,
      });
      expect(exhausted.error.result.issues).toHaveLength(0);
    }
  });

  it("names the exact per-review cost limit when costUsd would be exceeded", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxCostUsd: 0.05, maxConcurrency: 1 }));

    const first = ledger.reserveAttempt(estimate({ costUsd: 0.03 }));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(ledger.settleAttempt(first.value, estimate({ costUsd: 0.03 }))).toMatchObject({
      ok: true,
    });

    const second = ledger.reserveAttempt(estimate({ costUsd: 0.03 }));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.outcome).toBe("budget-exhausted");
      if (second.error.outcome === "budget-exhausted") {
        expect(second.error.limit).toBe("maxCostUsd");
      }
      expect(second.error.result.issues).toEqual([]);
    }
  });

  it("stays exhausted after the first limit breach", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxInputTokens: 100 }));

    const first = ledger.reserveAttempt(estimate({ inputTokens: 200 }));
    expect(first.ok).toBe(false);

    const second = ledger.reserveAttempt(estimate({ inputTokens: 1 }));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.outcome).toBe("budget-exhausted");
      if (second.error.outcome === "budget-exhausted") {
        expect(second.error.limit).toBe("maxInputTokens");
      }
    }
  });
});

describe("BudgetLedger settlement", () => {
  it("commits only the dimensions the provider reported", () => {
    const ledger = createBudgetLedger(sampleLimits());
    const reservation = ledger.reserveAttempt(estimate());
    expect(reservation.ok).toBe(true);
    if (!reservation.ok) return;

    const settled = ledger.settleAttempt(reservation.value, {
      inputTokens: 120,
      outputTokens: 40,
      wallTimeMs: 900,
    });

    expect(settled.ok).toBe(true);
    expect(ledger.snapshot().committed).toEqual({
      inputTokens: 120,
      outputTokens: 40,
      responseBytes: 0,
      wallTimeMs: 900,
      costUsd: 0,
    });
  });

  it("exhausts on measured bytes and cost when the provider does report them", () => {
    const ledger = createBudgetLedger(sampleLimits({ maxResponseBytes: 512 }));
    const reservation = ledger.reserveAttempt(estimate({ responseBytes: 0 }));
    expect(reservation.ok).toBe(true);
    if (!reservation.ok) return;

    const settled = ledger.settleAttempt(reservation.value, {
      inputTokens: 1,
      outputTokens: 1,
      wallTimeMs: 1,
      responseBytes: 1_024,
    });

    expect(settled.ok).toBe(false);
    if (settled.ok) return;
    expect(settled.error.limit).toBe("maxResponseBytes");
  });
});

function emptyUsage(): AttemptEstimate {
  return {
    inputTokens: 0,
    outputTokens: 0,
    responseBytes: 0,
    wallTimeMs: 0,
    costUsd: 0,
  };
}
