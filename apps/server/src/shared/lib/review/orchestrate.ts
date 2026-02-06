import { randomUUID } from "node:crypto";
import type { LensId } from "@stargazer/schemas/lens";
import type {
  ReviewIssue,
  ReviewOptions,
} from "@stargazer/schemas/review";
import { type Result, ok, err, getErrorMessage } from "@stargazer/core";
import type { AgentStreamEvent, LensStat } from "@stargazer/schemas/agent-event";
import { AGENT_METADATA, LENS_TO_AGENT } from "@stargazer/schemas/agent-event";
import type { StepEvent } from "@stargazer/schemas/step-event";
import type { AIClient } from "../ai/types.js";
import type { ParsedDiff } from "../diff/types.js";
import { getLenses } from "./lenses.js";
import { now } from "./utils.js";
import { filterIssuesByMinSeverity, deduplicateIssues, sortIssuesBySeverity, validateIssueCompleteness } from "./issues.js";
import { runLensAnalysis } from "./analysis.js";
import { runWithConcurrency } from "../concurrency.js";

type ReviewError = { code: string; message: string };

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
    timestamp: now(),
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
      timestamp: now(),
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
        }, orchestrationOptions.projectContext);
      } catch (error) {
        onEvent({
          type: "agent_error",
          agent: task.agentId,
          error: String(error),
          timestamp: now(),
          traceId,
          spanId: task.spanId,
        });
        throw error;
      }
    },
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
    timestamp: now(),
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
