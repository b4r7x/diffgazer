import { formatDuration } from "../../format.js";
import { getProviderDisplay } from "../../providers/display-status.js";
import type { RunnableProductId } from "../../schemas/config/transports.js";
import type { LensStat } from "../../schemas/events/index.js";
import type { ReviewMode, ReviewSeverity, TerminalOutcome } from "../../schemas/review/index.js";
import { capitalize, pluralize } from "../../strings.js";
import { hasFailedLenses } from "./agent-status.js";

/**
 * The failed-lens signal arrives in two shapes: live runs and saved reviews
 * carry per-lens `lensStats`, while a history row keeps only the count the
 * metadata persisted. Both are accepted so the predicate stays one function.
 */
export interface CleanRunInput {
  issueCount: number;
  lensStats?: readonly LensStat[] | undefined;
  failedLensCount?: number | undefined;
  terminalOutcome?: TerminalOutcome | undefined;
}

/**
 * Whether a run earned the unqualified pass: it reached its end, every lens
 * reported, and it found nothing. The history row's "Passed with no issues."
 * and the clean-run screen both read this, so the sentence and the screen it
 * opens can never disagree. A zero-issue run with a failed lens is partial,
 * not clean.
 */
export function isCleanRun({
  issueCount,
  lensStats,
  failedLensCount = 0,
  terminalOutcome = "completed",
}: CleanRunInput): boolean {
  if (issueCount !== 0) return false;
  if (terminalOutcome !== "completed") return false;
  return failedLensCount === 0 && !hasFailedLenses(lensStats);
}

/** Row labels for the clean-run receipt ledger, shared by both surfaces. */
export const CLEAN_RUN_RECEIPT_LABELS = {
  scope: "Scope",
  lenses: "Lenses",
  model: "Model",
  elapsed: "Elapsed",
  run: "Run",
} as const;

export interface ScopeValueInput {
  mode?: ReviewMode | undefined;
  fileCount?: number | undefined;
  additions?: number | undefined;
  deletions?: number | undefined;
}

/**
 * The Scope row's value: what the run read, and how much of it changed. A fact
 * the record does not carry is left out rather than shown as zero, so a legacy
 * run reads as a shorter row instead of a measured-looking `+0 -0`. The minus is
 * an ASCII hyphen because the TUI renders this in whatever font the terminal
 * has, and U+2212 is not in every one of them.
 */
export function buildScopeValue({
  mode,
  fileCount,
  additions,
  deletions,
}: ScopeValueInput): string | null {
  const changed = [
    additions === undefined ? null : `+${additions}`,
    deletions === undefined ? null : `-${deletions}`,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
  const parts = [
    mode ? capitalize(mode) : null,
    fileCount === undefined ? null : pluralize(fileCount, "file"),
    changed || null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The Model row's value. The durable fact is the model id the receipt kept, so
 * every path — live or saved, web or TUI — reads the same run the same way.
 * A record with no product to name it against falls back to the bare id.
 */
export function buildModelValue(
  productId: RunnableProductId | undefined,
  modelId: string | undefined,
): string | null {
  if (!productId) return modelId ?? null;
  return getProviderDisplay(productId, modelId);
}

export interface CleanRunStatementInput {
  droppedBelowThreshold?: number | undefined;
  minSeverity?: ReviewSeverity | undefined;
}

/**
 * The clean state's headline sentence. A run that hid findings below the
 * severity floor has not got a clean sheet, so the pass is qualified by the
 * floor instead of congratulating — the one case the screen must not claim
 * more than it checked. The ✔ glyph belongs to the surface, not the copy.
 */
export function buildCleanRunStatement({
  droppedBelowThreshold,
  minSeverity,
}: CleanRunStatementInput): string {
  if (!droppedBelowThreshold || droppedBelowThreshold <= 0) return "Passed — no issues found";
  return `No issues at or above ${minSeverity ?? "the severity threshold"}`;
}

export interface CleanRunFactLineInput {
  fileCount: number;
  lensCount: number;
  durationMs: number | undefined;
}

/** The evidence line under the statement: what was read, by how many lenses, for how long. */
export function buildCleanRunFactLine({
  fileCount,
  lensCount,
  durationMs,
}: CleanRunFactLineInput): string {
  const files = pluralize(fileCount, "file");
  const lenses = pluralize(lensCount, "lens", "lenses");
  return `No issues across ${files} · ${lenses} · ${formatDuration(durationMs)}`;
}
