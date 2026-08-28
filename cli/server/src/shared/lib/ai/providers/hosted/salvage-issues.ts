import type { LensReviewResult } from "@diffgazer/core/schemas/review";
import {
  MAX_REVIEW_ISSUES_PER_LENS,
  ProviderReviewIssueSchema,
} from "@diffgazer/core/schemas/review";
import { recoverJsonObjects } from "./recover-json.js";

export type SalvagedIssues = Readonly<{
  issues: LensReviewResult["issues"];
  droppedCount: number;
}>;

function issueCandidates(payload: unknown, content: string): unknown[] {
  const issues =
    typeof payload === "object" && payload !== null
      ? (payload as { issues?: unknown }).issues
      : undefined;
  return Array.isArray(issues) ? issues : recoverJsonObjects(content);
}

/**
 * The last tier of the output ladder, after the corrective re-ask is spent: the
 * findings that stand on their own are kept one at a time instead of dying with
 * the malformed answer around them. The candidates are the answer's own `issues`
 * elements when the response parsed, and otherwise the complete objects a
 * truncated answer closed before the cut. Each is validated alone against the
 * provider issue contract; nothing is repaired, so a half-written finding is
 * dropped rather than guessed at.
 */
export function salvageLensIssues(payload: unknown, content: string): SalvagedIssues {
  const candidates = issueCandidates(payload, content);
  const issues: LensReviewResult["issues"] = [];
  for (const candidate of candidates) {
    if (issues.length >= MAX_REVIEW_ISSUES_PER_LENS) break;
    const parsed = ProviderReviewIssueSchema.safeParse(candidate);
    if (parsed.success) issues.push(parsed.data);
  }
  return { issues, droppedCount: candidates.length - issues.length };
}
