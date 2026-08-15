import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

/**
 * Strips terminal escape/control sequences (CWE-150) from every model-controlled
 * free-text display field of a review issue at the server output-ingestion
 * boundary, so both the SSE stream and the persisted review are safe to render in
 * the Ink TUI (which passes OSC sequences through untouched).
 *
 * `id` is deliberately left raw: it is a selection identity (React key, navigation
 * target, details lookup), never terminal-rendered, and sanitizing it would
 * collapse two distinct findings whose ids differ only in control bytes into one
 * selection identity.
 *
 * Optional fields are re-emitted through conditional spreads so an absent field
 * stays an absent key. `field: issue.field?.map(...)` would materialize an
 * undefined-valued key, which canonical JSON rejects when the saved review is
 * validated against its execution result.
 */
export function sanitizeIssue(issue: ReviewIssue): ReviewIssue {
  return {
    ...issue,
    file: sanitizeTerminalText(issue.file),
    title: sanitizeTerminalText(issue.title),
    rationale: sanitizeTerminalText(issue.rationale),
    recommendation: sanitizeTerminalText(issue.recommendation),
    symptom: sanitizeTerminalText(issue.symptom),
    whyItMatters: sanitizeTerminalText(issue.whyItMatters),
    suggested_patch:
      issue.suggested_patch === null ? null : sanitizeTerminalText(issue.suggested_patch),
    ...(issue.betterOptions === undefined
      ? {}
      : { betterOptions: issue.betterOptions.map(sanitizeTerminalText) }),
    ...(issue.testsToAdd === undefined
      ? {}
      : { testsToAdd: issue.testsToAdd.map(sanitizeTerminalText) }),
    evidence: issue.evidence.map((ref) => ({
      ...ref,
      title: sanitizeTerminalText(ref.title),
      sourceId: sanitizeTerminalText(ref.sourceId),
      ...(ref.file === undefined ? {} : { file: sanitizeTerminalText(ref.file) }),
      ...(ref.sha === undefined ? {} : { sha: sanitizeTerminalText(ref.sha) }),
      excerpt: sanitizeTerminalText(ref.excerpt),
    })),
    ...(issue.fixPlan === undefined
      ? {}
      : {
          fixPlan: issue.fixPlan.map((step) => ({
            ...step,
            action: sanitizeTerminalText(step.action),
            ...(step.files === undefined ? {} : { files: step.files.map(sanitizeTerminalText) }),
          })),
        }),
    ...(issue.trace === undefined
      ? {}
      : {
          trace: issue.trace.map((step) => ({
            ...step,
            tool: sanitizeTerminalText(step.tool),
            inputSummary: sanitizeTerminalText(step.inputSummary),
            outputSummary: sanitizeTerminalText(step.outputSummary),
            timestamp: sanitizeTerminalText(step.timestamp),
            ...(step.artifacts === undefined
              ? {}
              : { artifacts: step.artifacts.map(sanitizeTerminalText) }),
          })),
        }),
  };
}
