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
    id: sanitizeTerminalText(issue.id),
    file: sanitizeTerminalText(issue.file),
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
      title: sanitizeTerminalText(ref.title),
      sourceId: sanitizeTerminalText(ref.sourceId),
      ...(ref.file === undefined ? {} : { file: sanitizeTerminalText(ref.file) }),
      ...(ref.sha === undefined ? {} : { sha: sanitizeTerminalText(ref.sha) }),
      excerpt: sanitizeTerminalText(ref.excerpt),
    })),
    fixPlan: issue.fixPlan?.map((step) => ({
      ...step,
      action: sanitizeTerminalText(step.action),
      ...(step.files === undefined ? {} : { files: step.files.map(sanitizeTerminalText) }),
    })),
    trace: issue.trace?.map((step) => ({
      ...step,
      tool: sanitizeTerminalText(step.tool),
      inputSummary: sanitizeTerminalText(step.inputSummary),
      outputSummary: sanitizeTerminalText(step.outputSummary),
      timestamp: sanitizeTerminalText(step.timestamp),
      ...(step.artifacts === undefined
        ? {}
        : { artifacts: step.artifacts.map(sanitizeTerminalText) }),
    })),
  };
}
