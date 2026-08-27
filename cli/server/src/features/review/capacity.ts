import { err, ok, type Result } from "@diffgazer/core/result";
import { ReviewErrorCode, type ReviewSizeWarning } from "@diffgazer/core/schemas/review";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import { resolveModelContextBudget } from "../../shared/lib/config/budget-ceiling.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import { estimateReviewPromptTokens } from "./engine/diff/estimate.js";
import { partitionDiff } from "./engine/diff/partition.js";
import type { ParsedDiff } from "./engine/diff/types.js";

/**
 * The diff size past which one review call stops reading the change well, even
 * on a model whose window swallows it whole. It only advises, never rejects:
 * the size that costs a review its quality is not the size that makes it
 * impossible.
 */
export const LARGE_DIFF_ADVISORY_BYTES = 512 * 1024;

function formatTokens(tokens: number): string {
  return tokens.toLocaleString("en-US");
}

function describeScope(parsed: ParsedDiff): string {
  const megabytes = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
  const files = parsed.files.length;
  return `${megabytes}MB across ${files} file${files === 1 ? "" : "s"}`;
}

function fileOverWindowMessage(params: {
  modelId: string;
  contextTokens: number;
  reservedAnswerTokens: number;
  filePath: string;
  fileTokens: number;
}): string {
  const { modelId, contextTokens, reservedAnswerTokens, filePath, fileTokens } = params;
  const answer =
    reservedAnswerTokens > 0
      ? ` plus ${formatTokens(reservedAnswerTokens)} reserved for the answer`
      : "";
  return (
    `${filePath} does not fit ${modelId} on its own. It is about ` +
    `${formatTokens(fileTokens)} prompt tokens${answer}, against a ` +
    `${formatTokens(contextTokens)}-token context window. Batching splits a review ` +
    `between files, never inside one, so exclude that file or switch to a model with a ` +
    `larger context window.`
  );
}

function batchedReviewMessage(params: {
  batchCount: number;
  estimatedTotalInputTokens: number;
  parsed: ParsedDiff;
}): string {
  const { batchCount, estimatedTotalInputTokens, parsed } = params;
  return (
    `This review is too large for one call: ${describeScope(parsed)}. Each lens reads it in ` +
    `${batchCount} sequential batches of whole files, about ` +
    `${formatTokens(estimatedTotalInputTokens)} input tokens for the whole run. A finding ` +
    `that spans two batches is only reachable by the synthesis pass that runs afterwards, ` +
    `so cross-file issues are less certain here than in a single-batch review. Reviewing ` +
    `fewer files at a time keeps the whole change in one pass.`
  );
}

function largeDiffMessage(params: {
  estimatedInputTokens: number;
  contextTokens: number | null;
  modelId: string | null;
  parsed: ParsedDiff;
}): string {
  const { estimatedInputTokens, contextTokens, modelId, parsed } = params;
  const fit =
    modelId !== null && contextTokens !== null
      ? `It fits ${modelId}'s ${formatTokens(contextTokens)}-token context window, but`
      : "It is within the configured limits, but";
  return (
    `Large review: ${describeScope(parsed)}, about ${formatTokens(estimatedInputTokens)} ` +
    `prompt tokens. ${fit} a model reading this much change in one pass finds less than ` +
    `it would across a few narrower reviews. Filtering to the files you care about will ` +
    `produce a sharper result.`
  );
}

/**
 * How the review will be dispatched: the batches each lens reads in turn, the
 * per-call budget they were packed against, what the whole run is estimated to
 * cost in input tokens across every lens, and the warning the user is owed.
 * `batches` always holds at least one entry; a single entry is the diff itself,
 * dispatched whole in one call per lens.
 *
 * `estimatedTotalInputTokens` prices the lens calls only; the synthesis pass a
 * batched review closes with lives off the envelope's headroom.
 */
export type ReviewCapacityPlan = {
  batches: ParsedDiff[];
  perCallBudgetTokens: number;
  estimatedTotalInputTokens: number;
  warning: ReviewSizeWarning | null;
};

/**
 * The model-aware size gate, run once the diff is parsed and the model that will
 * read it is known. It plans the review rather than only judging it: a diff over
 * the per-call budget is split into whole-file batches and disclosed, a diff that
 * is merely large is admitted with an advisory, and everything else is admitted
 * silently. One hard failure survives — a single file that does not fit the
 * model's window even alone, which no batching can rescue. Nothing here
 * truncates: a review of a diff the user did not choose is worse than a review
 * that says why it cannot run.
 *
 * The per-call budget is the smaller of what the window leaves after the answer
 * reservation and the user's `effectiveCallTokenCap`, because a model reads a
 * short call better than a full window.
 */
export function evaluateReviewCapacity(params: {
  parsed: ParsedDiff;
  plan: AdmittedExecutionPlan | undefined;
  effectiveCallTokenCap: number;
  lensCount: number;
}): Result<ReviewCapacityPlan, ReviewAbort> {
  const { parsed, plan, effectiveCallTokenCap, lensCount } = params;
  const modelId = plan?.evidenceKey.modelId ?? null;
  const budget = plan && modelId ? resolveModelContextBudget(plan.productId, modelId) : null;
  const windowInputTokens = budget ? budget.contextTokens - budget.reservedAnswerTokens : null;
  const perCallBudgetTokens = Math.min(
    effectiveCallTokenCap,
    windowInputTokens ?? effectiveCallTokenCap,
  );

  const batches = partitionDiff(parsed, perCallBudgetTokens);
  // A batched call names every file it does not carry a diff for, so a batch
  // costs more than its own files; a single-batch plan names none.
  const contextOnlyCount = (batch: ParsedDiff) => parsed.files.length - batch.files.length;

  if (modelId !== null && budget !== null && windowInputTokens !== null) {
    for (const batch of batches) {
      const batchTokens = estimateReviewPromptTokens(batch, contextOnlyCount(batch));
      // Only a lone file can outgrow the window: any batch with a neighbour fits
      // the per-call budget, which is never larger than the window allows.
      const [file] = batch.files;
      if (batchTokens <= windowInputTokens || file === undefined) continue;
      return err(
        reviewAbort(
          fileOverWindowMessage({
            modelId,
            ...budget,
            filePath: file.filePath,
            fileTokens: batchTokens,
          }),
          ReviewErrorCode.DIFF_TOO_LARGE,
          "diff",
        ),
      );
    }
  }

  const estimatedInputTokens = estimateReviewPromptTokens(parsed);
  const estimatedTotalInputTokens =
    lensCount *
    batches.reduce(
      (total, batch) => total + estimateReviewPromptTokens(batch, contextOnlyCount(batch)),
      0,
    );
  const contextTokens = budget?.contextTokens ?? null;
  const diffBytes = parsed.totalStats.totalSizeBytes;

  if (batches.length > 1) {
    return ok({
      batches,
      perCallBudgetTokens,
      estimatedTotalInputTokens,
      warning: {
        message: batchedReviewMessage({
          batchCount: batches.length,
          estimatedTotalInputTokens,
          parsed,
        }),
        diffBytes,
        estimatedInputTokens,
        contextTokens,
        modelId,
        batchCount: batches.length,
        estimatedTotalInputTokens,
      },
    });
  }

  const warning =
    diffBytes <= LARGE_DIFF_ADVISORY_BYTES
      ? null
      : {
          message: largeDiffMessage({ estimatedInputTokens, contextTokens, modelId, parsed }),
          diffBytes,
          estimatedInputTokens,
          contextTokens,
          modelId,
        };
  return ok({ batches, perCallBudgetTokens, estimatedTotalInputTokens, warning });
}
