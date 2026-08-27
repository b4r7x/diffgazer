import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { AgentStreamEvent, LensStat, StepEvent } from "@diffgazer/core/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE } from "../../../shared/lib/ai/diagnostics.js";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import { runLensAnalysis, runSynthesisAnalysis } from "./analysis.js";
import type { ParsedDiff } from "./diff/types.js";
import {
  deduplicateIssues,
  filterIssuesByMinSeverity,
  orderIssuesDeterministic,
} from "./issues/ordering.js";
import { getLenses } from "./lenses.js";
import type {
  LensSelection,
  OrchestrationError,
  OrchestrationOptions,
  OrchestrationOutcome,
  ReviewError,
} from "./types.js";

/**
 * The diagnostic codes a `schema-failed` dispatch receipt surfaces on its
 * stream error: the generic outcome code, plus the adapter's own cause-naming
 * diagnostics from the hosted execute path (malformed content, a truncated
 * answer, a completion budget burned on reasoning).
 */
const STRUCTURED_OUTPUT_DIAGNOSTIC_CODES = new Set([
  "schema-failed",
  "malformed-review-output",
  MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
  "output-truncated",
  "reasoning-budget-consumed",
]);

/**
 * The failure class that counts toward the structured-output verdict: the
 * schema bridge rejecting the parsed response, or an adapter dispatch whose own
 * receipt reported `schema-failed`. Every other failure (transport, timeout,
 * budget, cancellation) is about this attempt, not the tuple.
 */
function isStructuredOutputFailure(error: AIError): boolean {
  if (error.code === "PARSE_ERROR") return true;
  return (
    error.code === "STREAM_ERROR" &&
    error.diagnostic !== undefined &&
    STRUCTURED_OUTPUT_DIAGNOSTIC_CODES.has(error.diagnostic.code)
  );
}

/** A dispatch the per-review budget ledger refused to settle. */
function isBudgetExhausted(error: AIError): boolean {
  return error.code === "STREAM_ERROR" && error.diagnostic?.code === "budget-exhausted";
}

function isAbortRejection(reason: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (reason instanceof DOMException && reason.name === "AbortError") return true;
  return reason instanceof Error && reason.message === "Aborted";
}

/**
 * The rejection `runWithConcurrency` fills in for a slot it never launched.
 * Identity is the only thing that separates it from a dispatched task that threw
 * an abort-shaped error of its own.
 */
const UNDISPATCHED = new Error("Aborted");

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve) => {
    const resolveWithFill = () => {
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
          results[i] = { status: "rejected", reason: UNDISPATCHED };
        }
      }
      resolve(results);
    };

    const launchNext = () => {
      if (signal?.aborted) {
        if (active === 0) resolveWithFill();
        return;
      }

      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }

      while (active < limit && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        const item = items[currentIndex];
        if (item === undefined) {
          results[currentIndex] = {
            status: "rejected",
            reason: new Error("Missing item"),
          };
          continue;
        }
        active++;
        Promise.resolve(worker(item, currentIndex))
          .then((value) => {
            results[currentIndex] = { status: "fulfilled", value };
          })
          .catch((reason) => {
            results[currentIndex] = { status: "rejected", reason };
          })
          .finally(() => {
            active--;
            launchNext();
          });
      }
    };

    launchNext();
  });
}

export async function orchestrateReview(
  client: AIClient,
  diff: ParsedDiff,
  selection: LensSelection,
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  orchestrationOptions: OrchestrationOptions,
): Promise<Result<OrchestrationOutcome, OrchestrationError>> {
  if (diff.files.length === 0) {
    return err({ code: "NO_DIFF", message: "No files changed", lensStats: [] });
  }

  const { filter } = selection;
  const lenses = getLenses(selection.lenses);

  const concurrency = Math.min(orchestrationOptions.concurrency, Math.max(1, lenses.length));

  onEvent({
    type: "orchestrator_start",
    agents: lenses.map((lens) => AGENT_METADATA[LENS_TO_AGENT[lens.id]]),
    concurrency,
    ...(orchestrationOptions.requestedConcurrency !== undefined
      ? { requestedConcurrency: orchestrationOptions.requestedConcurrency }
      : {}),
    timestamp: new Date().toISOString(),
  });

  const tasks = lenses.map((lens, index) => {
    const agentId = LENS_TO_AGENT[lens.id];
    const agentMeta = AGENT_METADATA[agentId];

    onEvent({
      type: "agent_queued",
      agent: agentMeta,
      position: index + 1,
      total: lenses.length,
      timestamp: new Date().toISOString(),
    });

    return { lens, agentId };
  });

  // One lens schema failure proves nothing about the tuple: free-pool routes
  // flake, and the same model class still delivers real findings on a partial
  // run. Schema failures stay per-lens; the end-of-run fold decides
  // whether every lens schema-failed (the review-level structured-output
  // verdict) or the run is partial. The one bounded cost is that a truly
  // incapable tuple spends every lens's dispatches once — capped by the
  // budget ledger and review clock — before the conformance memo blocks it.
  const signal = orchestrationOptions.signal;
  // The first dispatch to exhaust the review budget has spent the envelope the
  // remaining lenses would draw on: dispatching them costs money for output the
  // ledger refuses. Stop launching new ones and abort those in flight — a dead
  // review must not keep billing. The review clock joins for the same reason.
  const budgetAbort = new AbortController();
  const reviewClock = orchestrationOptions.reviewClock;
  const dispatchSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    budgetAbort.signal,
    ...(reviewClock ? [reviewClock.signal] : []),
  ]);
  let anyLensSucceeded = false;

  const settledResults = await runWithConcurrency(
    tasks,
    concurrency,
    async (task) => {
      try {
        const result = await runLensAnalysis({
          client,
          lens: task.lens,
          batches: orchestrationOptions.batches ?? [diff],
          allChangedFilePaths: diff.files.map((file) => file.filePath),
          onEvent,
          projectContext: orchestrationOptions.projectContext,
          signal: dispatchSignal,
          severityFilter: filter,
        });
        if (result.ok) {
          anyLensSucceeded = true;
        } else if (isBudgetExhausted(result.error)) {
          budgetAbort.abort();
        }
        return result;
      } catch (error) {
        onEvent({
          type: "agent_error",
          agent: task.agentId,
          error: String(error),
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    },
    dispatchSignal,
  );

  const allIssues: ReviewIssue[] = [];
  const lensStats: LensStat[] = [];
  let failedLensCount = 0;
  let schemaFailedLensCount = 0;
  let lastError: ReviewError | null = null;
  let firstStructuredOutputError: ReviewError | null = null;
  let lastNonSchemaError: ReviewError | null = null;
  let droppedIncompleteProviderIssues = 0;
  // Budget death and a user cancellation abort a lens the same way, so only the
  // controller that fired tells them apart — and a lens stopped for budget,
  // whether never dispatched or aborted in flight, must not report a
  // cancellation the user never asked for.
  const stoppedForBudget =
    (budgetAbort.signal.aborted || reviewClock?.expired() === true) && signal?.aborted !== true;

  settledResults.forEach((settled, i) => {
    const lens = lenses[i];
    if (!lens) return;

    if (settled.status === "rejected") {
      // A rejected task is either an abort (synthetic "Aborted" fill or a signal
      // abort) or an unexpected internal throw — never a classified network
      // failure, which travels the `result.ok === false` branch below.
      const aborted = isAbortRejection(settled.reason, dispatchSignal);
      const notDispatched = settled.reason === UNDISPATCHED;
      const budgetCollateral = aborted && stoppedForBudget;
      const abortCode = budgetCollateral ? "BUDGET_EXHAUSTED" : "CANCELLED";
      const errorCode = aborted ? abortCode : "INTERNAL_ERROR";
      let errorMsg = getErrorMessage(settled.reason);
      if (notDispatched) {
        errorMsg = stoppedForBudget
          ? "Not dispatched — the review budget was exhausted."
          : "Not dispatched — the review was cancelled.";
      } else if (budgetCollateral) {
        errorMsg = "Cancelled — the review budget was exhausted.";
      }
      if (notDispatched) {
        // The lens never reached `runLensAnalysis`, the only other emitter of a
        // terminal agent event, so without this its board row stays queued.
        onEvent({
          type: "agent_error",
          agent: LENS_TO_AGENT[lens.id],
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });
      }
      lastError = { code: errorCode, message: errorMsg };
      lastNonSchemaError = lastError;
      lensStats.push({
        lensId: lens.id,
        issueCount: 0,
        status: "failed",
        errorCode,
        errorMessage: errorMsg,
      });
      failedLensCount += 1;
      return;
    }

    const result = settled.value;
    if (!result.ok) {
      // A dispatch whose receipt settled `cancelled` while the budget was dying
      // was aborted as collateral: the receipt names the mechanism, the stats
      // name the cause.
      const budgetCollateral = stoppedForBudget && result.error.diagnostic?.code === "cancelled";
      const errorCode = budgetCollateral ? "BUDGET_EXHAUSTED" : result.error.code;
      const errorMessage = budgetCollateral
        ? "Cancelled — the review budget was exhausted."
        : result.error.message;
      lastError = { code: errorCode, message: errorMessage };
      if (!budgetCollateral && isStructuredOutputFailure(result.error)) {
        schemaFailedLensCount += 1;
        firstStructuredOutputError ??= lastError;
      } else {
        lastNonSchemaError = lastError;
      }
      lensStats.push({
        lensId: lens.id,
        issueCount: 0,
        status: "failed",
        errorCode,
        errorMessage,
        dispatches: result.error.dispatches,
      });
      failedLensCount += 1;
      return;
    }

    allIssues.push(...result.value.issues);
    droppedIncompleteProviderIssues += result.value.droppedIncompleteProviderIssues;
    // Count only issues that meet the severity threshold, matching the streamed
    // per-agent counter so the persisted lens stats stay consistent with the UI.
    // A lens whose later batch failed still succeeded on what it dispatched, so
    // it reports its findings and names the error that cut the run short.
    lensStats.push({
      lensId: result.value.lensId,
      issueCount: filterIssuesByMinSeverity(result.value.issues, filter).length,
      status: "success",
      errorCode: result.value.batchError?.code,
      errorMessage: result.value.batchError?.message,
      dispatches: result.value.dispatches,
    });
  });

  // A batched review's per-lens calls never saw the whole diff at once, so one
  // synthesis pass reads the digest of everything they found and hunts for
  // cross-file problems. It is skipped when nothing decoded (the review is
  // failing anyway) and when dispatching stopped (cancelled or budget
  // spent). Its failure is a failed lens, never a failed
  // review: it stays out of `failedLensCount` and `lastError`, because the
  // per-batch findings are already paid for and cross-file coverage only adds.
  const batchCount = orchestrationOptions.batches?.length ?? 1;
  if (batchCount > 1 && anyLensSucceeded && !dispatchSignal.aborted) {
    const synthesisResult = await runSynthesisAnalysis({
      client,
      diff,
      collectedIssues: allIssues,
      onEvent,
      projectContext: orchestrationOptions.projectContext,
      signal: dispatchSignal,
      severityFilter: filter,
    });
    if (synthesisResult.ok) {
      allIssues.push(...synthesisResult.value.issues);
      droppedIncompleteProviderIssues += synthesisResult.value.droppedIncompleteProviderIssues;
      lensStats.push({
        lensId: "synthesis",
        issueCount: filterIssuesByMinSeverity(synthesisResult.value.issues, filter).length,
        status: "success",
        dispatches: synthesisResult.value.dispatches,
      });
    } else {
      lensStats.push({
        lensId: "synthesis",
        issueCount: 0,
        status: "failed",
        errorCode: synthesisResult.error.code,
        errorMessage: synthesisResult.error.message,
        dispatches: synthesisResult.error.dispatches,
      });
    }
  }

  const deduplicated = deduplicateIssues(allIssues);
  const droppedDuplicates = allIssues.length - deduplicated.length;
  const filtered = filterIssuesByMinSeverity(deduplicated, filter);
  const droppedBelowThreshold = deduplicated.length - filtered.length;
  const sorted = orderIssuesDeterministic(filtered);

  onEvent({
    type: "orchestrator_complete",
    totalIssues: sorted.length,
    lensStats,
    filesAnalyzed: diff.files.length,
    droppedDuplicates,
    droppedBelowThreshold,
    droppedIncompleteProviderIssues,
    minSeverity: filter?.minSeverity,
    timestamp: new Date().toISOString(),
  });

  const allLensesFailed = failedLensCount === lenses.length && lenses.length > 0;

  // Only a unanimous verdict indicts the tuple: every lens ran and every one
  // schema-failed. A mixed all-failed run (some 429s, one schema flake) is a
  // transport story, not a structured-output one, so the non-schema error
  // names it and the failure never reads as model incapacity.
  if (allLensesFailed) {
    if (schemaFailedLensCount === lenses.length && firstStructuredOutputError !== null) {
      const { code, message } = firstStructuredOutputError;
      return err({ code, message, allLensesSchemaFailed: true, lensStats });
    }
    if (lastError !== null) {
      const { code, message } = lastNonSchemaError ?? lastError;
      return err({ code, message, lensStats });
    }
  }

  return ok({
    issues: sorted,
    lensStats,
    droppedDuplicates,
    droppedBelowThreshold,
    minSeverity: filter?.minSeverity,
  });
}
