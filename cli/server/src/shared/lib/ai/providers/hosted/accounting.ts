import type { ExecutionLimits, NormalizedUsage } from "@diffgazer/core/schemas/review";
import { accumulateUsage } from "./wire.js";

export type ResponseAccounting = Readonly<{
  limits: ExecutionLimits;
  usage: NormalizedUsage | null;
  status: "accounted" | "unavailable" | "budget-exhausted";
}>;

/** Draws one answer down against the admitted envelope and folds its usage into the receipt total. */
export function accountResponse(
  limits: ExecutionLimits,
  reportedUsage: NormalizedUsage | null,
  attemptUsage: NormalizedUsage | null,
  responseBytes: number,
): ResponseAccounting {
  const nextLimits = {
    ...limits,
    maxResponseBytes: limits.maxResponseBytes - responseBytes,
  };
  if (nextLimits.maxResponseBytes < 0) {
    return { limits: nextLimits, usage: reportedUsage, status: "budget-exhausted" };
  }
  if (!attemptUsage) {
    return { limits: nextLimits, usage: reportedUsage, status: "unavailable" };
  }

  const usage = accumulateUsage(reportedUsage, attemptUsage);
  if (!usage) {
    return { limits: nextLimits, usage: reportedUsage, status: "unavailable" };
  }

  // Cumulative input is the enforced token dimension; there is no total-token
  // bound, so a long answer never retroactively exhausts a paid-for attempt.
  const nextInputTokens = limits.maxInputTokens - (attemptUsage.inputTokens ?? 0);
  const overCap = nextInputTokens < 0;
  return {
    limits: {
      ...nextLimits,
      maxInputTokens: nextInputTokens,
    },
    usage,
    status: overCap ? "budget-exhausted" : "accounted",
  };
}
