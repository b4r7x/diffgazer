import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { AgentStreamEvent, LensStat, StepEvent } from "@diffgazer/core/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/core/schemas/events";
import type { LensId, ReviewIssue, ReviewOptions } from "@diffgazer/core/schemas/review";
import type { AIClient } from "../../../shared/lib/ai/types.js";
import { runLensAnalysis } from "./analysis.js";
import type { ParsedDiff } from "./diff/types.js";
import { deduplicateIssues, filterIssuesByMinSeverity, sortIssuesBySeverity } from "./issues.js";
import { getLenses } from "./lenses.js";
import type { OrchestrationOptions, OrchestrationOutcome, ReviewError } from "./types.js";

function isAbortRejection(reason: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (reason instanceof DOMException && reason.name === "AbortError") return true;
  return reason instanceof Error && reason.message === "Aborted";
}

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
          results[i] = { status: "rejected", reason: new Error("Aborted") };
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
  reviewOptions: ReviewOptions = {},
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  orchestrationOptions: OrchestrationOptions,
): Promise<Result<OrchestrationOutcome, ReviewError>> {
  if (diff.files.length === 0) {
    return err({ code: "NO_DIFF", message: "No files changed" });
  }

  const selectedLensIds = (reviewOptions.lenses?.length ? reviewOptions.lenses : undefined) ??
    (reviewOptions.profile?.lenses.length ? reviewOptions.profile.lenses : undefined) ?? [
      "correctness",
    ];
  const lensIds = [...new Set(selectedLensIds)];
  const lenses = getLenses(lensIds);
  const filter = reviewOptions.filter ?? reviewOptions.profile?.filter;

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

  const settledResults = await runWithConcurrency(
    tasks,
    concurrency,
    async (task) => {
      try {
        return await runLensAnalysis(
          client,
          task.lens,
          diff,
          onEvent,
          orchestrationOptions.projectContext,
          orchestrationOptions.signal,
          filter,
        );
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
    orchestrationOptions.signal,
  );

  const allIssues: ReviewIssue[] = [];
  const lensStats: LensStat[] = [];
  const failedLenses: Array<{ lensId: LensId; errorCode?: string; errorMessage?: string }> = [];
  let lastError: ReviewError | null = null;
  let droppedIncompleteProviderIssues = 0;

  settledResults.forEach((settled, i) => {
    const lens = lenses[i];
    if (!lens) return;

    if (settled.status === "rejected") {
      const errorMsg = getErrorMessage(settled.reason);
      // A rejected task is either an abort (synthetic "Aborted" fill or a signal
      // abort) or an unexpected internal throw — never a classified network
      // failure, which travels the `result.ok === false` branch below.
      const errorCode = isAbortRejection(settled.reason, orchestrationOptions.signal)
        ? "CANCELLED"
        : "INTERNAL_ERROR";
      lastError = { code: errorCode, message: errorMsg };
      lensStats.push({
        lensId: lens.id,
        issueCount: 0,
        status: "failed",
        errorCode,
        errorMessage: errorMsg,
      });
      failedLenses.push({ lensId: lens.id, errorCode, errorMessage: errorMsg });
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
      failedLenses.push({
        lensId: lens.id,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      });
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
  const sorted = sortIssuesBySeverity(filtered);

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

  const allLensesFailed = failedLenses.length === lenses.length && lenses.length > 0;

  if (allLensesFailed && lastError !== null) {
    if (orchestrationOptions.partialOnAllFailed) {
      return ok({
        issues: [],
        lensStats,
        failedLenses,
        droppedDuplicates,
        droppedBelowThreshold,
        droppedIncompleteProviderIssues,
        minSeverity: filter?.minSeverity,
      });
    }
    return err(lastError);
  }

  return ok({
    issues: sorted,
    lensStats,
    failedLenses,
    droppedDuplicates,
    droppedBelowThreshold,
    droppedIncompleteProviderIssues,
    minSeverity: filter?.minSeverity,
  });
}
