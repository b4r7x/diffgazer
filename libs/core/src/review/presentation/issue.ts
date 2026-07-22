import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type SeverityCounts,
} from "../../schemas/presentation/index.js";
import type { FixPlanStep, ReviewIssue } from "../../schemas/review/index.js";

const SEVERITY_BREAKDOWN_WIDTH = 16;

export interface SeverityBreakdownRow {
  severity: ReviewIssue["severity"];
  label: string;
  count: number;
  total: number;
  filledCells: number;
  emptyCells: number;
}

/** Builds every severity row, including zero-count rows, in canonical severity order. */
export function buildSeverityBreakdownRows(counts: SeverityCounts): SeverityBreakdownRow[] {
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + counts[severity], 0);
  return SEVERITY_ORDER.map((severity) => {
    const count = counts[severity];
    const filledCells = total > 0 ? Math.round((count / total) * SEVERITY_BREAKDOWN_WIDTH) : 0;
    return {
      severity,
      label: SEVERITY_LABELS[severity],
      count,
      total,
      filledCells,
      emptyCells: SEVERITY_BREAKDOWN_WIDTH - filledCells,
    };
  });
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
  range: string;
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
  return `${String(start)}-${String(end)}`;
}

/** Builds the issue metadata and fix-plan contract shared by web and TUI details panes. */
export function toIssueDetailsPresentation(issue: ReviewIssue): IssueDetailsPresentation {
  const range = formatIssueLineRange(issue.line_start, issue.line_end);
  return {
    category: issue.category,
    confidence: `${String(Math.round(issue.confidence * 100))}%`,
    range,
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
  return `${SEVERITY_LABELS[severity]} ${String(count)}`;
}
