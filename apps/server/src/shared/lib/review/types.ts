import type { Lens, LensId } from "@diffgazer/schemas/review";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { LensStat } from "@diffgazer/schemas/events";

export interface LensResult {
  lensId: Lens["id"];
  lensName: string;
  summary: string;
  issues: ReviewIssue[];
}

export interface AgentRunContext {
  traceId: string;
  spanId: string;
  parentSpanId: string;
}

export type ReviewError = { code: string; message: string };

export type OrchestrationOutcome = {
  summary: string;
  issues: ReviewIssue[];
  lensStats: LensStat[];
  failedLenses: Array<{ lensId: LensId; errorCode?: string; errorMessage?: string }>;
};

export interface OrchestrationOptions {
  concurrency: number;
  projectContext?: string;
  /**
   * When true, returns ok() with a partial-analysis summary even when all lenses fail.
   * When false, returns err(lastError) when all lenses fail and no issues were found.
   */
  partialOnAllFailed?: boolean;
  signal?: AbortSignal;
}
