import { SEVERITY_LABELS, SEVERITY_ORDER } from "../../schemas/presentation/index.js";
import {
  EVIDENCE_GAP_MARKER,
  type EvidenceRef,
  type FixPlanStep,
  isValidEvidenceRange,
  type ReviewIssue,
  type SeverityCounts,
} from "../../schemas/review/index.js";

const EVIDENCE_PRESENTATION_LABELS = {
  code: "Code evidence",
  doc: "Unverified documentation reference",
  trace: "Unverified trace reference",
  external: "Unverified external reference",
} as const satisfies Record<EvidenceRef["type"], string>;

interface EvidencePresentationBase {
  title: string;
  sourceText: string;
  excerpt: string;
  ordinal: number;
}

export type EvidencePresentation =
  | (EvidencePresentationBase & {
      kind: "code";
      type: "code";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["code"];
      file: string;
      startLine?: number;
      /**
       * One gutter number per excerpt row, `null` where a row stands in for
       * skipped lines rather than printing one. Undefined when the excerpt
       * carries no trustworthy location at all, which is a surface's signal to
       * render no gutter instead of guessing one.
       */
      lineNumbers?: readonly (number | null)[];
    })
  | (EvidencePresentationBase & {
      kind: "reference";
      type: "doc";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["doc"];
    })
  | (EvidencePresentationBase & {
      kind: "reference";
      type: "trace";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["trace"];
    })
  | (EvidencePresentationBase & {
      kind: "reference";
      type: "external";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["external"];
    });

function isPrintableLineNumber(line: number | null): line is number {
  return line !== null && Number.isInteger(line) && line > 0;
}

/**
 * Resolves the gutter of one code excerpt. Per-row numbers are authoritative
 * when the writer published them. Runs saved before they existed carry only a
 * range: numbering from its start fits a contiguous excerpt, but the old server
 * also wrote windowed excerpts whose only trace of the skipped lines is the gap
 * marker row — numbering through one would mislabel everything past it.
 */
function toExcerptLineNumbers(evidence: EvidenceRef): readonly (number | null)[] | undefined {
  if (evidence.excerpt.length === 0) return undefined;

  const rows = evidence.excerpt.split("\n");
  const published = evidence.excerptLineNumbers;
  if (published !== undefined) {
    // A row-count mismatch means the numbering no longer describes this excerpt,
    // and shifted numbers are worse than none.
    if (published.length !== rows.length) return undefined;
    return published.map((line) => (isPrintableLineNumber(line) ? line : null));
  }

  const range = isValidEvidenceRange(evidence.range) ? evidence.range : undefined;
  if (range === undefined) return undefined;
  if (rows.includes(EVIDENCE_GAP_MARKER)) return undefined;
  return rows.map((_, offset) => range.start + offset);
}

export function toEvidencePresentation(
  evidence: EvidenceRef,
  fallbackCodeFile: string,
  ordinal: number,
): EvidencePresentation {
  const base = {
    title: evidence.title,
    sourceText: evidence.sourceId,
    excerpt: evidence.excerpt,
    ordinal,
  };

  switch (evidence.type) {
    case "code": {
      // Both bounds come from the same accepted range, so a surface never pairs
      // a validated start with a raw provider end.
      const range = isValidEvidenceRange(evidence.range) ? evidence.range : undefined;
      return {
        ...base,
        kind: "code",
        type: "code",
        label: EVIDENCE_PRESENTATION_LABELS.code,
        file: evidence.file ?? fallbackCodeFile,
        startLine: range?.start,
        lineNumbers: toExcerptLineNumbers(evidence),
      };
    }
    case "doc":
      return {
        ...base,
        kind: "reference",
        type: "doc",
        label: EVIDENCE_PRESENTATION_LABELS.doc,
      };
    case "trace":
      return {
        ...base,
        kind: "reference",
        type: "trace",
        label: EVIDENCE_PRESENTATION_LABELS.trace,
      };
    case "external":
      return {
        ...base,
        kind: "reference",
        type: "external",
        label: EVIDENCE_PRESENTATION_LABELS.external,
      };
  }
}

export interface SeverityBreakdownRow {
  severity: ReviewIssue["severity"];
  label: string;
  count: number;
  total: number;
}

/** Builds every severity row, including zero-count rows, in canonical severity order. */
export function buildSeverityBreakdownRows(counts: SeverityCounts): SeverityBreakdownRow[] {
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + counts[severity], 0);
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    label: SEVERITY_LABELS[severity],
    count: counts[severity],
    total,
  }));
}

export interface IssueFixStepPresentation {
  completionIndex: number;
  number: number;
  action: string;
  risk?: FixPlanStep["risk"];
  files: readonly string[];
}

export interface IssueDetailsPresentation {
  category: ReviewIssue["category"];
  confidence: string;
  location: string;
  fixPlan: readonly IssueFixStepPresentation[];
  trace: readonly IssueTraceStepPresentation[];
}

export interface IssueTraceStepPresentation {
  step: number;
  tool: string;
  timestamp: string;
  input: { label: "in:"; summary: string };
  output: { label: "out:"; summary: string };
}

function formatIssueLineRange(start: number | null, end: number | null): string {
  if (start == null) return "?";
  if (end == null) return String(start);
  return `${start}-${end}`;
}

/** Builds the issue metadata and fix-plan contract shared by web and TUI details panes. */
export function toIssueDetailsPresentation(issue: ReviewIssue): IssueDetailsPresentation {
  const range = formatIssueLineRange(issue.line_start, issue.line_end);
  return {
    category: issue.category,
    confidence: `${Math.round(issue.confidence * 100)}%`,
    location: `${issue.file}:${range}`,
    fixPlan: (issue.fixPlan ?? []).map((step, completionIndex) => ({
      completionIndex,
      number: step.step,
      action: step.action,
      risk: step.risk,
      files: [...(step.files ?? [])],
    })),
    trace: (issue.trace ?? []).map((step) => ({
      step: step.step,
      tool: step.tool,
      timestamp: step.timestamp,
      input: { label: "in:", summary: step.inputSummary },
      output: { label: "out:", summary: step.outputSummary },
    })),
  };
}

export function formatSeverityFilterLabel(
  severity: ReviewIssue["severity"],
  count: number,
): string {
  return `${SEVERITY_LABELS[severity]} ${count}`;
}
