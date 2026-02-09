import { randomUUID } from "node:crypto";
import type { LensId } from "@diffgazer/schemas/review";
import type {
  ReviewIssue,
  ReviewOptions,
} from "@diffgazer/schemas/review";
import { type Result, ok, err } from "@diffgazer/core/result";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { AgentStreamEvent, LensStat, StepEvent } from "@diffgazer/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/schemas/events";
import type { AIClient } from "../ai/types.js";
import type { ParsedDiff } from "../diff/types.js";
import { getLenses } from "./lenses.js";
import { filterIssuesByMinSeverity, deduplicateIssues, sortIssuesBySeverity, validateIssueCompleteness } from "./issues.js";
import { runLensAnalysis } from "./analysis.js";
import type { ReviewError, OrchestrationOutcome, OrchestrationOptions } from "./types.js";

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
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
        active++;
        Promise.resolve(worker(items[currentIndex]!, currentIndex))
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

  const lensIds = reviewOptions.lenses ?? reviewOptions.profile?.lenses ?? ["correctness"];
  const lenses = getLenses(lensIds);
  const filter = reviewOptions.filter ?? reviewOptions.profile?.filter;

  const traceId = randomUUID();
  const orchestratorSpanId = randomUUID();
  const concurrency = Math.min(orchestrationOptions.concurrency, Math.max(1, lenses.length));

  onEvent({
    type: "orchestrator_start",
    agents: lenses.map((lens) => AGENT_METADATA[LENS_TO_AGENT[lens.id]]),
    concurrency,
    timestamp: new Date().toISOString(),
    traceId,
    spanId: orchestratorSpanId,
  });

  const tasks = lenses.map((lens, index) => {
    const agentId = LENS_TO_AGENT[lens.id];
    const agentMeta = AGENT_METADATA[agentId];
    const spanId = randomUUID();

    onEvent({
      type: "agent_queued",
      agent: agentMeta,
      position: index + 1,
      total: lenses.length,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
    });

    return { lens, agentId, spanId };
  });

  const settledResults = await runWithConcurrency(
    tasks,
    concurrency,
    async (task) => {
      try {
        return await runLensAnalysis(client, task.lens, diff, onEvent, {
          traceId,
          spanId: task.spanId,
          parentSpanId: orchestratorSpanId,
        }, orchestrationOptions.projectContext, orchestrationOptions.signal);
      } catch (error) {
        onEvent({
          type: "agent_error",
          agent: task.agentId,
          error: String(error),
          timestamp: new Date().toISOString(),
          traceId,
          spanId: task.spanId,
        });
        throw error;
      }
    },
    orchestrationOptions.signal,
  );

  const allIssues: ReviewIssue[] = [];
  const summaries: string[] = [];
  const lensStats: LensStat[] = [];
  const failedLenses: Array<{ lensId: LensId; errorCode?: string; errorMessage?: string }> = [];
  let lastError: ReviewError | null = null;

  settledResults.forEach((settled, i) => {
    const lens = lenses[i];
    if (!lens) return;

    if (settled.status === "rejected") {
      lastError = { code: "NETWORK_ERROR", message: String(settled.reason) };
      lensStats.push({ lensId: lens.id, issueCount: 0, status: "failed", errorCode: "NETWORK_ERROR", errorMessage: String(settled.reason) });
      failedLenses.push({ lensId: lens.id, errorCode: "NETWORK_ERROR", errorMessage: String(settled.reason) });
      return;
    }

    const result = settled.value;
    if (!result.ok) {
      lastError = result.error;
      lensStats.push({ lensId: lens.id, issueCount: 0, status: "failed", errorCode: result.error.code, errorMessage: result.error.message });
      failedLenses.push({ lensId: lens.id, errorCode: result.error.code, errorMessage: result.error.message });
      return;
    }

    allIssues.push(...result.value.issues);
    summaries.push(`[${result.value.lensName}] ${result.value.summary}`);
    lensStats.push({ lensId: result.value.lensId, issueCount: result.value.issues.length, status: "success" });
  });

  const deduplicated = deduplicateIssues(allIssues);
  const filtered = filterIssuesByMinSeverity(deduplicated, filter);
  const validated = filtered.filter(validateIssueCompleteness);
  const sorted = sortIssuesBySeverity(validated);

  const failedSummary = failedLenses.length > 0
    ? `Partial analysis: ${failedLenses.map((f) => `${f.lensId}${f.errorCode ? ` (${f.errorCode})` : ""}`).join(", ")} failed.`
    : "";
  const combinedSummary = [summaries.join("\n\n"), failedSummary].filter(Boolean).join("\n\n");

  onEvent({
    type: "orchestrator_complete",
    summary: combinedSummary,
    totalIssues: sorted.length,
    lensStats,
    filesAnalyzed: diff.files.length,
    timestamp: new Date().toISOString(),
    traceId,
    spanId: orchestratorSpanId,
  });

  // When no issues found and all lenses failed
  if (sorted.length === 0 && lastError !== null) {
    if (orchestrationOptions.partialOnAllFailed) {
      return ok({
        summary: combinedSummary || `Analysis incomplete: ${getErrorMessage(lastError)}`,
        issues: [],
        lensStats,
        failedLenses,
      });
    }
    return err(lastError);
  }

  return ok({
    summary: combinedSummary,
    issues: sorted,
    lensStats,
    failedLenses,
  });
}
