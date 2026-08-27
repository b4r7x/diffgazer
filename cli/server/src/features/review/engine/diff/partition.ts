import {
  estimateFileTokens,
  PROMPT_SCAFFOLD_TOKENS,
  PROMPT_TOKENS_PER_CONTEXT_FILE,
} from "./estimate.js";
import { computeTotalStats } from "./total-stats.js";
import type { FileDiff, ParsedDiff } from "./types.js";

/**
 * Splits a diff into batches a single call can read: whole files, in diff order,
 * each batch's prompt estimate (its files plus one scaffold) within
 * `perCallBudgetTokens`. A file is never split — a hunk read without its
 * neighbours is a worse review than a batch boundary.
 *
 * A file whose own estimate already exceeds the budget still gets a batch, alone.
 * Partitioning cannot make it smaller, and whether that is fatal is the capacity
 * gate's call against the model window, not this function's.
 *
 * A diff that fits one batch comes back as the same object, so a single-batch
 * dispatch is identical to an unbatched one.
 *
 * Each batch's prompt also names every file changed elsewhere in the review, so
 * a batch is charged the full roster up front and refunded one row per file it
 * takes in. A diff that ends up in one batch is charged nothing for it, which is
 * exactly what that prompt carries.
 */
export function partitionDiff(parsed: ParsedDiff, perCallBudgetTokens: number): ParsedDiff[] {
  const batchedFiles: FileDiff[][] = [];
  const batchBaseTokens =
    PROMPT_SCAFFOLD_TOKENS + PROMPT_TOKENS_PER_CONTEXT_FILE * parsed.files.length;
  let currentFiles: FileDiff[] = [];
  let currentTokens = batchBaseTokens;

  for (const file of parsed.files) {
    const fileTokens = estimateFileTokens(file) - PROMPT_TOKENS_PER_CONTEXT_FILE;
    if (currentFiles.length > 0 && currentTokens + fileTokens > perCallBudgetTokens) {
      batchedFiles.push(currentFiles);
      currentFiles = [];
      currentTokens = batchBaseTokens;
    }
    currentFiles.push(file);
    currentTokens += fileTokens;
  }
  if (currentFiles.length > 0) {
    batchedFiles.push(currentFiles);
  }

  if (batchedFiles.length <= 1) {
    return [parsed];
  }

  return batchedFiles.map((files) => ({ files, totalStats: computeTotalStats(files) }));
}
