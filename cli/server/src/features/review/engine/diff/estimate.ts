import type { FileDiff, ParsedDiff } from "./types.js";

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
export const PROMPT_SCAFFOLD_TOKENS = 1_300;

/** The `<files-changed>` row plus the `<code-diff>` wrapper each file adds. */
const PROMPT_TOKENS_PER_FILE = 64;

/**
 * The name-only `<files-changed>` row a batched call carries for each file
 * changed elsewhere in the review — no diff, no id, just the path and the
 * fixed "changed elsewhere" sentence. Every batch pays it for every file it
 * does not hold, so a batched plan that ignored it would under-price its own
 * prompts by more the more files the review touches.
 */
export const PROMPT_TOKENS_PER_CONTEXT_FILE = 28;

/** What one file costs a prompt: its escaped diff plus its row and wrapper. */
export function estimateFileTokens(file: FileDiff): number {
  return (
    Math.ceil((file.stats.sizeBytes * PROMPT_ESCAPE_GROWTH) / DIFF_BYTES_PER_TOKEN) +
    PROMPT_TOKENS_PER_FILE
  );
}

/**
 * What the review's prompt will cost the model, in tokens:
 *
 *   diffBytes x PROMPT_ESCAPE_GROWTH / DIFF_BYTES_PER_TOKEN
 *   + PROMPT_TOKENS_PER_FILE x fileCount
 *   + PROMPT_TOKENS_PER_CONTEXT_FILE x contextOnlyFileCount
 *   + PROMPT_SCAFFOLD_TOKENS
 *
 * `contextOnlyFileCount` is how many files the review changes that this call
 * does NOT carry a diff for; a batched prompt names each of them.
 *
 * Every lens sends its own copy, so this is the cost of one call — which is the
 * unit a context window is measured in too.
 *
 * The project-context block is deliberately absent. It is built after the review
 * starts, so its size is not knowable here, only bounded; reserving that bound
 * would fail small-window models over a block that is usually a fraction of it.
 * The admitted input budget still guards the assembled prompt at dispatch.
 */
export function estimateReviewPromptTokens(parsed: ParsedDiff, contextOnlyFileCount = 0): number {
  const diffTokens = Math.ceil(
    (parsed.totalStats.totalSizeBytes * PROMPT_ESCAPE_GROWTH) / DIFF_BYTES_PER_TOKEN,
  );
  return (
    diffTokens +
    PROMPT_TOKENS_PER_FILE * parsed.files.length +
    PROMPT_TOKENS_PER_CONTEXT_FILE * contextOnlyFileCount +
    PROMPT_SCAFFOLD_TOKENS
  );
}
