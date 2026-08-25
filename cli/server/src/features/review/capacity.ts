import { err, ok, type Result } from "@diffgazer/core/result";
import { ReviewErrorCode, type ReviewSizeWarning } from "@diffgazer/core/schemas/review";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import { resolveModelContextBudget } from "../../shared/lib/config/budget-ceiling.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import type { ParsedDiff } from "./engine/diff/types.js";

/**
 * XML-escaping the diff into `<code-diff>` blocks grows it: `&`, `<`, `>`, `"`,
 * and `'` each become 4-6 bytes. Source diffs run a few percent of those
 * characters, markup-heavy ones more, so the estimate plans against 5%.
 */
const PROMPT_ESCAPE_GROWTH = 1.05;

/**
 * Bytes of escaped diff per token. The dispatch-time estimator prices an
 * already-built prompt at 4 bytes/token; diff text is denser than that average —
 * indentation, punctuation, and the leading `+`/`-` markers each tend to cost a
 * token of their own — so this gate plans against 3.3 and never admits a review
 * the dispatch gate would turn around and reject.
 */
const DIFF_BYTES_PER_TOKEN = 3.3;

/**
 * The fixed scaffold every lens prompt carries: the lens system prompt, the
 * severity rubric, and the response-shape instructions. Roughly 4KB of ASCII.
 */
const PROMPT_SCAFFOLD_TOKENS = 1_300;

/** The `<files-changed>` row plus the `<code-diff>` wrapper each file adds. */
const PROMPT_TOKENS_PER_FILE = 64;

/**
 * The diff size past which one review call stops reading the change well, even
 * on a model whose window swallows it whole. It only advises, never rejects:
 * the size that costs a review its quality is not the size that makes it
 * impossible.
 */
export const LARGE_DIFF_ADVISORY_BYTES = 512 * 1024;

/**
 * What the review's prompt will cost the model, in tokens:
 *
 *   diffBytes x PROMPT_ESCAPE_GROWTH / DIFF_BYTES_PER_TOKEN
 *   + PROMPT_TOKENS_PER_FILE x fileCount
 *   + PROMPT_SCAFFOLD_TOKENS
 *
 * Every lens sends its own copy, so this is the cost of one call — which is the
 * unit a context window is measured in too.
 *
 * The project-context block is deliberately absent. It is built after the review
 * starts, so its size is not knowable here, only bounded; reserving that bound
 * would fail small-window models over a block that is usually a fraction of it.
 * The admitted input budget still guards the assembled prompt at dispatch.
 */
export function estimateReviewPromptTokens(parsed: ParsedDiff): number {
  const diffTokens = Math.ceil(
    (parsed.totalStats.totalSizeBytes * PROMPT_ESCAPE_GROWTH) / DIFF_BYTES_PER_TOKEN,
  );
  return diffTokens + PROMPT_TOKENS_PER_FILE * parsed.files.length + PROMPT_SCAFFOLD_TOKENS;
}

function formatTokens(tokens: number): string {
  return tokens.toLocaleString("en-US");
}

function describeScope(parsed: ParsedDiff): string {
  const megabytes = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
  const files = parsed.files.length;
  return `${megabytes}MB across ${files} file${files === 1 ? "" : "s"}`;
}

function overWindowMessage(params: {
  modelId: string;
  contextTokens: number;
  reservedAnswerTokens: number;
  estimatedInputTokens: number;
  parsed: ParsedDiff;
}): string {
  const { modelId, contextTokens, reservedAnswerTokens, estimatedInputTokens, parsed } = params;
  const answer =
    reservedAnswerTokens > 0
      ? ` plus ${formatTokens(reservedAnswerTokens)} reserved for the answer`
      : "";
  return (
    `This diff does not fit ${modelId}. It is ${describeScope(parsed)}, about ` +
    `${formatTokens(estimatedInputTokens)} prompt tokens${answer}, against a ` +
    `${formatTokens(contextTokens)}-token context window. Review a subset of the files, ` +
    `or switch to a model with a larger context window.`
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
 * The model-aware size gate, run once the diff is parsed and the model that will
 * read it is known. Three outcomes and no fourth: a diff past the window is a
 * hard failure that names the numbers, a diff that is merely large is admitted
 * with an advisory, and everything else is admitted silently. Nothing here
 * truncates — a review of a diff the user did not choose is worse than a review
 * that says why it cannot run.
 */
export function evaluateReviewCapacity(params: {
  parsed: ParsedDiff;
  plan: AdmittedExecutionPlan | undefined;
}): Result<ReviewSizeWarning | null, ReviewAbort> {
  const { parsed, plan } = params;
  const modelId = plan?.evidenceKey.modelId ?? null;
  const budget = plan && modelId ? resolveModelContextBudget(plan.productId, modelId) : null;
  const estimatedInputTokens = estimateReviewPromptTokens(parsed);

  if (
    modelId !== null &&
    budget !== null &&
    estimatedInputTokens + budget.reservedAnswerTokens > budget.contextTokens
  ) {
    return err(
      reviewAbort(
        overWindowMessage({ modelId, ...budget, estimatedInputTokens, parsed }),
        ReviewErrorCode.DIFF_TOO_LARGE,
        "diff",
      ),
    );
  }

  if (parsed.totalStats.totalSizeBytes <= LARGE_DIFF_ADVISORY_BYTES) {
    return ok(null);
  }

  const contextTokens = budget?.contextTokens ?? null;
  return ok({
    message: largeDiffMessage({ estimatedInputTokens, contextTokens, modelId, parsed }),
    diffBytes: parsed.totalStats.totalSizeBytes,
    estimatedInputTokens,
    contextTokens,
    modelId,
  });
}
