import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

/**
 * Strips terminal escape/control sequences (CWE-150) from every model-controlled
 * free-text field of a review issue at the server output-ingestion boundary, so
 * both the SSE stream and the persisted review are safe to render in the Ink TUI
 * (which passes OSC sequences through untouched).
 */
export function sanitizeIssue(issue: ReviewIssue): ReviewIssue {
  return {
    ...issue,
    title: sanitizeTerminalText(issue.title),
    rationale: sanitizeTerminalText(issue.rationale),
    recommendation: sanitizeTerminalText(issue.recommendation),
    symptom: sanitizeTerminalText(issue.symptom),
    whyItMatters: sanitizeTerminalText(issue.whyItMatters),
    suggested_patch:
      issue.suggested_patch === null ? null : sanitizeTerminalText(issue.suggested_patch),
    betterOptions: issue.betterOptions?.map(sanitizeTerminalText),
    testsToAdd: issue.testsToAdd?.map(sanitizeTerminalText),
    evidence: issue.evidence.map((ref) => ({
      ...ref,
      excerpt: sanitizeTerminalText(ref.excerpt),
    })),
    fixPlan: issue.fixPlan?.map((step) => ({
      ...step,
      action: sanitizeTerminalText(step.action),
    })),
  };
}
