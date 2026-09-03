import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import type { AgentId, AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/core/schemas/events";
import type {
  Lens,
  LensReviewResult,
  ReviewIssue,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import {
  LensReviewResultSchema,
  MAX_REVIEW_ISSUES_PER_LENS,
  severityRank,
} from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import type { AIClient, AIError, GenerateSuccess } from "../../../shared/lib/ai/types.js";
import { log } from "../../../shared/lib/log.js";
import type { ParsedDiff } from "./diff/types.js";
import { createIssueEvidenceResolver } from "./issues/evidence.js";
import {
  dropProviderTrace,
  normalizeIssueLineFields,
  validateIssueCompleteness,
} from "./issues/normalization.js";
import { severityMeetsMinimum } from "./issues/ordering.js";
import { SYNTHESIS_LENS } from "./lenses.js";
import { buildReviewPrompt, buildSynthesisPrompt, type ReviewPrompt } from "./prompts.js";
import { sanitizeIssue } from "./sanitize-issue.js";
import type { LensAnalysisError, LensDispatch, LensResult } from "./types.js";

function getThinkingMessage(lens: Lens): string {
  switch (lens.id) {
    case "correctness":
      return "Analyzing diff for bugs and logic errors...";
    case "security":
      return "Analyzing diff for security vulnerabilities...";
    case "performance":
      return "Analyzing diff for performance issues...";
    case "simplicity":
      return "Analyzing diff for complexity and maintainability...";
    case "tests":
      return "Analyzing diff for test coverage and quality...";
    case "synthesis":
      return "Connecting findings across review batches...";
  }
}

function countDiffLines(diff: ParsedDiff): number {
  return diff.files.reduce((sum, file) => sum + file.rawDiff.split("\n").length, 0);
}

// Namespace ids by lens so the same raw id from independent lenses stays a
// distinct selection identity across the cross-lens merge (ids survive dedupe,
// which keys on file/line/title); a deterministic `#n` suffix separates
// same-raw-id duplicates within one lens.
function ensureUniqueIssueIds(issues: ReviewIssue[], lensId: Lens["id"]): ReviewIssue[] {
  const seen = new Set<string>();
  return issues.map((issue) => {
    const namespacedId = `${lensId}:${issue.id}`;
    let uniqueId = namespacedId;
    let attempt = 2;
    while (seen.has(uniqueId)) {
      uniqueId = `${namespacedId}#${attempt}`;
      attempt++;
    }
    seen.add(uniqueId);
    return { ...issue, id: uniqueId };
  });
}

function resolvePromptFileIdentities(
  issue: ReviewIssue,
  filePathsById: ReadonlyMap<string, string>,
): ReviewIssue | null {
  const filePath = filePathsById.get(issue.file);
  if (filePath === undefined) return null;

  const evidence: ReviewIssue["evidence"] = [];
  for (const reference of issue.evidence) {
    if (reference.file === undefined) {
      evidence.push(reference.type === "code" ? { ...reference, file: filePath } : reference);
      continue;
    }
    const evidenceFilePath = filePathsById.get(reference.file);
    if (evidenceFilePath === undefined) return null;
    evidence.push({ ...reference, file: evidenceFilePath });
  }

  let fixPlan: ReviewIssue["fixPlan"];
  if (issue.fixPlan) {
    fixPlan = [];
    for (const step of issue.fixPlan) {
      if (step.files === undefined) {
        fixPlan.push(step);
        continue;
      }
      const files: string[] = [];
      for (const fileId of step.files) {
        const resolvedFile = filePathsById.get(fileId);
        if (resolvedFile === undefined) return null;
        files.push(resolvedFile);
      }
      fixPlan.push({ ...step, files });
    }
  }

  return {
    ...issue,
    file: filePath,
    evidence,
    ...(fixPlan === undefined ? {} : { fixPlan }),
  };
}

/**
 * Resolves one batch's provider issues against that batch's own prompt identities
 * and diff. Opaque `file-N` ids are batch-local, so this has to run per batch,
 * before the batches' issues are concatenated.
 */
function resolveBatchIssues(
  batch: ParsedDiff,
  promptFiles: ReviewPrompt["files"],
  providerIssues: LensReviewResult["issues"],
): { issues: ReviewIssue[]; droppedCount: number } {
  const filePathsById = new Map(promptFiles.map(({ id, file }) => [id, file.filePath]));
  const ensureEvidence = createIssueEvidenceResolver(batch);
  const resolvedIssues: ReviewIssue[] = [];
  let droppedUnknownFileIdentities = 0;
  for (const issue of providerIssues) {
    const resolvedIssue = resolvePromptFileIdentities(issue, filePathsById);
    if (resolvedIssue === null) {
      droppedUnknownFileIdentities += 1;
      continue;
    }
    resolvedIssues.push(resolvedIssue);
  }

  const normalizedIssues = resolvedIssues
    .map((issue: ReviewIssue) => normalizeIssueLineFields(issue))
    .map((issue: ReviewIssue) => ensureEvidence(issue))
    .map((issue: ReviewIssue) => dropProviderTrace(issue))
    .map((issue: ReviewIssue) => sanitizeIssue(issue));
  const completeIssues = normalizedIssues.filter(validateIssueCompleteness);

  return {
    issues: completeIssues,
    droppedCount: normalizedIssues.length - completeIssues.length + droppedUnknownFileIdentities,
  };
}

/**
 * Keeps the highest-severity issues, in their original order, when concatenated
 * batches overflow the per-lens cap the persisted result is validated against.
 * Each single call is already capped by `LensReviewResultSchema`; only a batched
 * lens can exceed it.
 */
function capIssuesBySeverity(issues: ReviewIssue[], lensId: Lens["id"]): ReviewIssue[] {
  if (issues.length <= MAX_REVIEW_ISSUES_PER_LENS) return issues;
  log("warn", "lens_issue_cap_exceeded", {
    lensId,
    cap: MAX_REVIEW_ISSUES_PER_LENS,
    dropped: issues.length - MAX_REVIEW_ISSUES_PER_LENS,
  });
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort(
      (a, b) =>
        severityRank(a.issue.severity) - severityRank(b.issue.severity) || a.index - b.index,
    )
    .slice(0, MAX_REVIEW_ISSUES_PER_LENS)
    .sort((a, b) => a.index - b.index)
    .map(({ issue }) => issue);
}

function emitDispatchError(
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  agentId: AgentId,
  error: AIError,
): void {
  onEvent({
    type: "agent_error",
    agent: agentId,
    error: `${dispatchOutcome(error)}: ${error.message}`,
    timestamp: new Date().toISOString(),
  });
}

type BatchFailureDisposition =
  | "retrying after the remaining batches"
  | "retrying once"
  | "giving up"
  | "not retried";

function emitBatchFailure(
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  agentId: AgentId,
  batchIndex: number,
  batchCount: number,
  error: AIError,
  disposition: BatchFailureDisposition,
): void {
  const subject = batchCount > 1 ? `Batch ${batchIndex + 1}/${batchCount}` : "Dispatch";
  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 65,
    message: `${subject} failed (${dispatchOutcome(error)}) — ${disposition}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * A failure the engine may re-queue once: the adapter's own retry ladder is
 * spent and its diagnostic says waiting can clear it — pacing 429
 * (`provider-rejected`), HTTP 5xx (`transport-failed`) and both wall/HTTP-client
 * expiries (`timed-out`) all arrive `retryable: true`. Everything else —
 * 401/402/403/404/413, exhausted-quota 429, `budget-exhausted`, `cancelled`,
 * schema failures, HTTP 400, an error with no diagnostic — ends the lens at once.
 */
function isRetryableDispatchFailure(error: AIError): boolean {
  return error.diagnostic?.retryable === true;
}

/** The dispatch row's label: the diagnostic's cause code, else the bridge code. */
function dispatchOutcome(error: AIError): string {
  return error.diagnostic?.code ?? error.code;
}

/** A planned batch waiting to be dispatched; `retryOf` is the retryable failure a re-queue defers. */
type QueuedBatch = { batchIndex: number; batch: ParsedDiff; retryOf?: AIError };

/**
 * Streams the issues that meet the threshold and closes the lens's event pair.
 * The full set is still what the caller persists.
 */
function streamLensCompletion(params: {
  agentId: AgentId;
  issues: ReviewIssue[];
  severityFilter: SeverityFilter | undefined;
  onEvent: (event: AgentStreamEvent | StepEvent) => void;
}): void {
  const { agentId, issues, severityFilter, onEvent } = params;
  const streamedIssues = severityFilter
    ? issues.filter((issue) => severityMeetsMinimum(issue.severity, severityFilter.minSeverity))
    : issues;

  for (const issue of streamedIssues) {
    onEvent({
      type: "issue_found",
      agent: agentId,
      issue,
      timestamp: new Date().toISOString(),
    });
  }

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 90,
    message: `Found ${pluralize(streamedIssues.length, "issue")}`,
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_complete",
    agent: agentId,
    issueCount: streamedIssues.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * The wait is the only thing the user sees during a non-streaming dispatch, so
 * the heartbeat says how long it may last, not just how long it has lasted, and
 * a dispatch state that explains the silence — a rate-limit backoff — replaces
 * the headline for exactly as long as it holds.
 */
async function generateWithWaitProgress(params: {
  client: AIClient;
  prompt: string;
  system: string;
  agentId: AgentId;
  batchSuffix: string;
  dispatchWallTimeMs?: number;
  onEvent: (event: AgentStreamEvent | StepEvent) => void;
  signal?: AbortSignal;
}): Promise<Result<GenerateSuccess<typeof LensReviewResultSchema>, AIError>> {
  const { client, prompt, system, agentId, batchSuffix, dispatchWallTimeMs, onEvent, signal } =
    params;
  const timerStart = Date.now();
  const wallSuffix =
    dispatchWallTimeMs === undefined ? "" : ` of up to ${Math.round(dispatchWallTimeMs / 1000)}s`;
  let dispatchNote: { message: string; until: number } | null = null;
  const progressTimer = setInterval(() => {
    if (signal?.aborted) {
      clearInterval(progressTimer);
      return;
    }
    const elapsedSec = Math.round((Date.now() - timerStart) / 1000);
    const headline =
      dispatchNote && Date.now() < dispatchNote.until
        ? dispatchNote.message
        : "Waiting for model response";
    onEvent({
      type: "agent_progress",
      agent: agentId,
      progress: 65,
      message: `${headline} — ${elapsedSec}s${wallSuffix}${batchSuffix}`,
      timestamp: new Date().toISOString(),
    });
  }, 2000);

  try {
    return await client.generate(prompt, LensReviewResultSchema, {
      signal,
      systemPrompt: system,
      onProgress: ({ message, holdsForMs }) => {
        dispatchNote = { message, until: Date.now() + holdsForMs };
      },
    });
  } finally {
    clearInterval(progressTimer);
  }
}

export interface LensAnalysisOptions {
  client: AIClient;
  lens: Lens;
  /**
   * Dispatch batches, run in order; never empty. A single batch dispatches
   * exactly what an unbatched review dispatches.
   */
  batches: readonly ParsedDiff[];
  /** Every path the review changed, so each batch can name what it cannot see. */
  allChangedFilePaths: readonly string[];
  /** The admitted per-dispatch wall: named in the wait heartbeat, and the room a re-queue must still have. */
  dispatchWallTimeMs?: number;
  /** The review clock. A failed batch is re-queued only while it still fits one full dispatch. */
  reviewClock?: { remainingMs(): number };
  onEvent: (event: AgentStreamEvent | StepEvent) => void;
  projectContext?: string;
  signal?: AbortSignal;
  severityFilter?: SeverityFilter;
}

export async function runLensAnalysis({
  client,
  lens,
  batches,
  allChangedFilePaths,
  dispatchWallTimeMs,
  reviewClock,
  onEvent,
  projectContext,
  signal,
  severityFilter,
}: LensAnalysisOptions): Promise<Result<LensResult, LensAnalysisError>> {
  const agentId = LENS_TO_AGENT[lens.id];
  const agentMeta = AGENT_METADATA[agentId];
  const batchCount = batches.length;
  const totalFiles = batches.reduce((sum, batch) => sum + batch.files.length, 0);

  onEvent({
    type: "agent_start",
    agent: agentMeta,
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: getThinkingMessage(lens),
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 15,
    message: `Gathering context (${totalFiles} files)`,
    timestamp: new Date().toISOString(),
  });

  const collectedIssues: ReviewIssue[] = [];
  const dispatches: LensDispatch[] = [];
  let droppedIncompleteProviderIssues = 0;
  let droppedCandidateCount = 0;
  let filesReported = 0;
  let completedBatchCount = 0;
  let batchError: AIError | undefined;

  // A re-queued attempt is a dispatch the envelope never counted
  // (`reviewCallCount`, pipeline.ts): it runs only in the slack the review clock
  // still has for one whole dispatch, and never once dispatching was aborted.
  const canRequeue = (): boolean =>
    signal?.aborted !== true &&
    (reviewClock === undefined ||
      dispatchWallTimeMs === undefined ||
      reviewClock.remainingMs() >= dispatchWallTimeMs);

  // The plan in dispatch order. A batch whose first attempt failed retryably
  // goes to the back of the queue once, so the rest of the plan runs first. A
  // single-batch plan has nothing to run first, so its one re-queue is
  // dispatched at once under the same clock gate. Batch failures are announced
  // as `agent_progress` notices; only a lens with no completed batch files an
  // `agent_error`.
  const queue: QueuedBatch[] = batches.map((batch, batchIndex) => ({ batchIndex, batch }));

  for (let queued = queue.shift(); queued !== undefined; queued = queue.shift()) {
    const { batchIndex, batch, retryOf } = queued;
    if (retryOf !== undefined && !canRequeue()) {
      emitBatchFailure(onEvent, agentId, batchIndex, batchCount, retryOf, "not retried");
      batchError = retryOf;
      continue;
    }
    const retrySuffix = retryOf === undefined ? "" : ", retry";
    const singleBatchSuffix = retryOf === undefined ? "" : " (retry)";
    const batchSuffix =
      batchCount > 1 ? ` (batch ${batchIndex + 1}/${batchCount}${retrySuffix})` : singleBatchSuffix;
    const {
      user: prompt,
      system,
      files: promptFiles,
    } = buildReviewPrompt(lens, batch, projectContext, allChangedFilePaths);

    if (retryOf === undefined) {
      for (const { file } of promptFiles) {
        filesReported += 1;
        onEvent({
          type: "file_progress",
          agent: agentId,
          file: file.filePath,
          completed: filesReported,
          total: totalFiles,
          timestamp: new Date().toISOString(),
        });
      }
    }

    onEvent({
      type: "agent_progress",
      agent: agentId,
      progress: 60,
      message: `Prompt includes ${pluralize(promptFiles.length, "file")} and ${pluralize(countDiffLines(batch), "diff line")}${batchSuffix}`,
      timestamp: new Date().toISOString(),
    });

    onEvent({
      type: "agent_progress",
      agent: agentId,
      progress: 65,
      message: `Waiting for model response${batchSuffix}`,
      timestamp: new Date().toISOString(),
    });

    const dispatchStartedAt = new Date().toISOString();
    const result = await generateWithWaitProgress({
      client,
      prompt,
      system,
      agentId,
      batchSuffix,
      dispatchWallTimeMs,
      onEvent,
      signal,
    });
    dispatches.push({
      batchIndex,
      startedAt: dispatchStartedAt,
      finishedAt: new Date().toISOString(),
      outcome: result.ok ? "completed" : dispatchOutcome(result.error),
    });

    if (!result.ok) {
      const retryable = isRetryableDispatchFailure(result.error);
      if (retryable && retryOf === undefined) {
        emitBatchFailure(
          onEvent,
          agentId,
          batchIndex,
          batchCount,
          result.error,
          batchCount > 1 ? "retrying after the remaining batches" : "retrying once",
        );
        queue.push({ batchIndex, batch, retryOf: result.error });
        continue;
      }
      if (batchCount > 1)
        emitBatchFailure(onEvent, agentId, batchIndex, batchCount, result.error, "giving up");
      batchError = result.error;
      if (retryable) continue;
      // A non-retryable failure ends dispatching. Re-queued batches still waiting are
      // announced as not retried; batches never attempted leave no row, as before.
      for (const pending of queue) {
        if (pending.retryOf !== undefined) {
          emitBatchFailure(
            onEvent,
            agentId,
            pending.batchIndex,
            batchCount,
            pending.retryOf,
            "not retried",
          );
        }
      }
      break;
    }

    const batchIssues = resolveBatchIssues(batch, promptFiles, result.value.data.issues);
    collectedIssues.push(...batchIssues.issues);
    droppedIncompleteProviderIssues += batchIssues.droppedCount;
    droppedCandidateCount += result.value.warning?.droppedCandidateCount ?? 0;
    completedBatchCount += 1;
  }

  if (batchError !== undefined && completedBatchCount === 0) {
    emitDispatchError(onEvent, agentId, batchError);
    return err({ ...batchError, dispatches });
  }

  const uniqueIssues = ensureUniqueIssueIds(collectedIssues, lens.id);
  const processedIssues = capIssuesBySeverity(uniqueIssues, lens.id);

  streamLensCompletion({ agentId, issues: processedIssues, severityFilter, onEvent });

  return ok({
    lensId: lens.id,
    issues: processedIssues,
    droppedIncompleteProviderIssues,
    droppedCandidateCount,
    batchError,
    dispatches,
  });
}

export interface SynthesisAnalysisOptions {
  client: AIClient;
  /** The whole review's diff: file identities and evidence resolve against every changed file. */
  diff: ParsedDiff;
  collectedIssues: readonly ReviewIssue[];
  /** The admitted per-dispatch wall, named in the wait heartbeat. */
  dispatchWallTimeMs?: number;
  onEvent: (event: AgentStreamEvent | StepEvent) => void;
  projectContext?: string;
  signal?: AbortSignal;
  severityFilter?: SeverityFilter;
}

/**
 * The one cross-batch dispatch of a batched review. It follows the per-lens
 * grammar — one `agent_start`/`agent_complete` pair, issues streamed as
 * `issue_found` — so its findings persist and render like any lens's.
 */
export async function runSynthesisAnalysis({
  client,
  diff,
  collectedIssues,
  dispatchWallTimeMs,
  onEvent,
  projectContext,
  signal,
  severityFilter,
}: SynthesisAnalysisOptions): Promise<Result<LensResult, LensAnalysisError>> {
  const lens = SYNTHESIS_LENS;
  const agentId = LENS_TO_AGENT[lens.id];

  onEvent({
    type: "agent_start",
    agent: AGENT_METADATA[agentId],
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: getThinkingMessage(lens),
    timestamp: new Date().toISOString(),
  });

  const {
    user: prompt,
    system,
    files: promptFiles,
  } = buildSynthesisPrompt(lens, diff, collectedIssues, projectContext);

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 65,
    message: "Waiting for model response",
    timestamp: new Date().toISOString(),
  });

  const dispatchStartedAt = new Date().toISOString();
  const result = await generateWithWaitProgress({
    client,
    prompt,
    system,
    agentId,
    batchSuffix: "",
    dispatchWallTimeMs,
    onEvent,
    signal,
  });
  const dispatches: LensDispatch[] = [
    {
      batchIndex: 0,
      startedAt: dispatchStartedAt,
      finishedAt: new Date().toISOString(),
      outcome: result.ok ? "completed" : dispatchOutcome(result.error),
    },
  ];

  if (!result.ok) {
    emitDispatchError(onEvent, agentId, result.error);
    return err({ ...result.error, dispatches });
  }

  const resolved = resolveBatchIssues(diff, promptFiles, result.value.data.issues);
  const processedIssues = capIssuesBySeverity(
    ensureUniqueIssueIds(resolved.issues, lens.id),
    lens.id,
  );

  streamLensCompletion({ agentId, issues: processedIssues, severityFilter, onEvent });

  return ok({
    lensId: lens.id,
    issues: processedIssues,
    droppedIncompleteProviderIssues: resolved.droppedCount,
    droppedCandidateCount: result.value.warning?.droppedCandidateCount ?? 0,
    dispatches,
  });
}
