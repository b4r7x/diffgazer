import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { AgentStreamEvent, LensStat, StepEvent } from "@diffgazer/core/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import { runLensAnalysis } from "./analysis.js";
import type { ParsedDiff } from "./diff/types.js";
import {
  deduplicateIssues,
  filterIssuesByMinSeverity,
  orderIssuesDeterministic,
} from "./issues/ordering.js";
import { getLenses } from "./lenses.js";
import type {
  LensSelection,
  OrchestrationOptions,
  OrchestrationOutcome,
  ReviewError,
} from "./types.js";

/**
 * The failure class that says the admitted tuple cannot produce structured
 * review output at all: the schema bridge rejecting the parsed response, or an
 * adapter dispatch whose own receipt reported `schema-failed`. Every other
 * failure (transport, timeout, budget, cancellation) is about this attempt.
 */
function isStructuredOutputFailure(error: AIError): boolean {
  if (error.code === "PARSE_ERROR") return true;
  return error.code === "STREAM_ERROR" && error.diagnostic?.code === "schema-failed";
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
): Promise<Result<OrchestrationOutcome, ReviewError>> {
  if (diff.files.length === 0) {
    return err({ code: "NO_DIFF", message: "No files changed" });
  }

  const { filter } = selection;
  const lenses = getLenses(selection.lenses);

  const concurrency = Math.min(orchestrationOptions.concurrency, Math.max(1, lenses.length));

  onEvent({
    type: "orchestrator_start",
    agents: lenses.map((lens) => AGENT_METADATA[LENS_TO_AGENT[lens.id]]),
    concurrency,
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

  // The first structured-output failure, before any lens has produced findings,
  // proves the tuple itself cannot run reviews. Stop launching the remaining
  // lenses and cancel the ones in flight instead of paying for every dispatch.
  const structuredOutputAbort = new AbortController();
  const signals = [orchestrationOptions.signal, structuredOutputAbort.signal].filter(
    (candidate): candidate is AbortSignal => candidate !== undefined,
  );
  const signal = AbortSignal.any(signals);
  // The first dispatch to exhaust the review budget has spent the envelope the
  // remaining lenses would draw on: dispatching them costs money for output the
  // ledger refuses. Stop launching new ones and let those in flight settle.
  const budgetAbort = new AbortController();
  const dispatchSignal = AbortSignal.any([signal, budgetAbort.signal]);
  let anyLensSucceeded = false;
  let structuredOutputError: ReviewError | null = null;

  const settledResults = await runWithConcurrency(
    tasks,
    concurrency,
    async (task) => {
      try {
        const result = await runLensAnalysis(
          client,
          task.lens,
          diff,
          onEvent,
          orchestrationOptions.projectContext,
          signal,
          filter,
        );
        if (result.ok) {
          anyLensSucceeded = true;
        } else if (!anyLensSucceeded && isStructuredOutputFailure(result.error)) {
          structuredOutputError ??= { code: result.error.code, message: result.error.message };
          structuredOutputAbort.abort();
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
  let lastError: ReviewError | null = null;
  let droppedIncompleteProviderIssues = 0;
  // The budget abort and a user cancellation reject an undispatched lens with
  // the same synthetic reason, so only the controller that fired tells them
  // apart — and a lens skipped for budget must not report a cancellation.
  const skippedForBudget = budgetAbort.signal.aborted && !signal.aborted;

  settledResults.forEach((settled, i) => {
    const lens = lenses[i];
    if (!lens) return;

    if (settled.status === "rejected") {
      // A rejected task is either an abort (synthetic "Aborted" fill or a signal
      // abort) or an unexpected internal throw — never a classified network
      // failure, which travels the `result.ok === false` branch below.
      const aborted = isAbortRejection(settled.reason, signal);
      const notDispatched = settled.reason === UNDISPATCHED && skippedForBudget;
      const abortCode = notDispatched ? "BUDGET_EXHAUSTED" : "CANCELLED";
      const errorCode = aborted ? abortCode : "INTERNAL_ERROR";
      const errorMsg = notDispatched
        ? "Not dispatched — the review budget was exhausted."
        : getErrorMessage(settled.reason);
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
      lastError = result.error;
      lensStats.push({
        lensId: lens.id,
        issueCount: 0,
        status: "failed",
        errorCode: result.error.code,
        errorMessage: result.error.message,
      });
      failedLensCount += 1;
      return;
    }

    allIssues.push(...result.value.issues);
    droppedIncompleteProviderIssues += result.value.droppedIncompleteProviderIssues;
    // Count only issues that meet the severity threshold, matching the streamed
    // per-agent counter so the persisted lens stats stay consistent with the UI.
    lensStats.push({
      lensId: result.value.lensId,
      issueCount: filterIssuesByMinSeverity(result.value.issues, filter).length,
      status: "success",
    });
  });

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

  // A structured-output failure is decisive only while nothing has decoded. A
  // lens that came back with findings — even one already in flight when the
  // abort fired — disproves the tuple's incapacity, so the review reports its
  // findings and the aborted lenses as per-lens failures instead.
  if (structuredOutputError !== null && !anyLensSucceeded) {
    return err(structuredOutputError);
  }

  const allLensesFailed = failedLensCount === lenses.length && lenses.length > 0;

  if (allLensesFailed && lastError !== null) {
    return err(lastError);
  }

  return ok({
    issues: sorted,
    lensStats,
    droppedDuplicates,
    droppedBelowThreshold,
    minSeverity: filter?.minSeverity,
  });
}
