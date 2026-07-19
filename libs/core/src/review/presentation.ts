import { isApiError } from "../api/types.js";
import type { SetupStatus } from "../schemas/config/index.js";
import { ErrorCode } from "../schemas/errors.js";
import type { AgentState, AgentStatus, LensStat } from "../schemas/events/index.js";
import {
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type SeverityCounts,
} from "../schemas/presentation/index.js";
import type { FixPlanStep, ReviewIssue, ReviewMode } from "../schemas/review/index.js";
import { pluralize } from "../strings.js";
import type { DetailsEmptyKind } from "./details-empty.js";

export interface ReviewEmptyCopy {
  title: string;
  description?: string;
}

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

export const DETAILS_EMPTY_COPY = {
  "no-issues": {
    title: "No issues in this review",
    description: "This analysis passed without issues.",
  },
  "filter-empty": {
    title: "No issues match this filter",
    description: "Choose another severity to continue.",
  },
  "no-selection": {
    title: "Select an issue to view details",
  },
} as const satisfies Record<DetailsEmptyKind, ReviewEmptyCopy>;

export interface ReviewNoChangesCopy {
  title: string;
  message: string;
  switchLabel: string;
}

export const NO_CHANGES_COPY = {
  staged: {
    title: "No Staged Changes",
    message:
      "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead.",
    switchLabel: "Review Unstaged",
  },
  unstaged: {
    title: "No Unstaged Changes",
    message: "No unstaged changes found. Make some edits first, or review staged changes instead.",
    switchLabel: "Review Staged",
  },
  files: {
    title: "No Changes in Selected Files",
    message:
      "No changes found in the selected files. Make some edits first, or select different files.",
    switchLabel: "Review Unstaged",
  },
} as const satisfies Record<ReviewMode, ReviewNoChangesCopy>;

export function getAlternateReviewMode(mode: ReviewMode): ReviewMode {
  return mode === "unstaged" ? "staged" : "unstaged";
}

export type AgentStatusBadgeVariant = "neutral" | "info" | "success" | "error";

export const AGENT_STATUS_META = {
  queued: { label: "WAIT", variant: "neutral" },
  running: { label: "RUN", variant: "info" },
  complete: { label: "DONE", variant: "success" },
  error: { label: "FAIL", variant: "error" },
} as const satisfies Record<
  AgentStatus,
  {
    label: string;
    variant: AgentStatusBadgeVariant;
  }
>;

export function getDetailsEmptyCopy(kind: DetailsEmptyKind): ReviewEmptyCopy {
  return DETAILS_EMPTY_COPY[kind];
}

export function getNoChangesCopy(mode: ReviewMode): ReviewNoChangesCopy {
  return NO_CHANGES_COPY[mode];
}

export function getAgentStatusMeta(status: AgentStatus): {
  label: string;
  variant: AgentStatusBadgeVariant;
} {
  return AGENT_STATUS_META[status];
}

export interface PartialFailureWarning {
  hasPartialFailure: boolean;
  message: string;
}

/**
 * Derives the post-review partial-failure warning shown when some agents failed
 * but the run did not error out. Suppressed while an error is surfaced so the
 * error takes precedence.
 */
export function getPartialFailureWarning(
  agents: readonly AgentState[],
  error: string | null,
  lensStats?: readonly LensStat[],
): PartialFailureWarning {
  const failedAgents = agents.filter((agent) => agent.status === "error");
  const hasPartialFailure = failedAgents.length > 0 && !error;
  if (!hasPartialFailure) return { hasPartialFailure: false, message: "" };

  const failedAgentNames = failedAgents.map((agent) => agent.meta.name).join(", ");
  const allFailedLensesWereRateLimited = failedAgents.every((agent) =>
    lensStats?.some(
      (stat) =>
        stat.lensId === agent.meta.lens &&
        stat.status === "failed" &&
        stat.errorCode === "RATE_LIMITED",
    ),
  );
  const failureReason = allFailedLensesWereRateLimited ? " (rate limited)" : "";
  return {
    hasPartialFailure: true,
    message: `${pluralize(failedAgents.length, "agent")} failed${failureReason}: ${failedAgentNames}. Results may be incomplete.`,
  };
}

export interface ApiKeyMissingCopy {
  title: string;
  body: string;
}

export const CONFIGURE_PROVIDER_LABEL = "Configure Provider";

export const CONFIGURATION_ERROR_COPY = {
  title: "Configuration Unavailable",
  body: "Diffgazer could not load the current configuration. Retry the request or return home.",
} as const;

export function getApiKeyMissingCopy(input: {
  provider?: string;
  missing: Readonly<SetupStatus["missing"]>;
}): ApiKeyMissingCopy {
  const forProvider = input.provider ? ` for ${input.provider}` : "";
  if (input.missing.includes("secretsStorage")) {
    return {
      title: "Secrets Storage Required",
      body: "Choose a secrets storage backend in Settings before starting a review.",
    };
  }
  if (!input.missing.includes("provider") && input.missing.includes("model")) {
    return {
      title: "Model Required",
      body: `No model selected${forProvider}. Set up a model in Settings to start reviewing code.`,
    };
  }
  return {
    title: "API Key Required",
    body: `No API key configured${forProvider}. Add your API key in Settings to start reviewing code.`,
  };
}

export interface ReviewStartErrorDescription {
  title: string;
  message: string;
}

export function describeReviewStartError(error: unknown): ReviewStartErrorDescription {
  if (!isApiError(error)) {
    return {
      title: "Failed to Start Review",
      message: "Could not create a review session.",
    };
  }

  switch (error.code) {
    case ErrorCode.API_KEY_MISSING:
      return {
        title: "API Key Missing",
        message: `${error.message}. Add one in Settings → Providers.`,
      };
    case "UNSUPPORTED_PROVIDER":
      return {
        title: "Provider Not Configured",
        message: "Pick an AI provider in Settings → Providers.",
      };
    case "MODEL_ERROR":
      return { title: "Model Not Selected", message: error.message };
    case "KEYRING_READ_FAILED":
      return {
        title: "Credential Storage Unavailable",
        message: `${error.message}. Check Settings → Storage.`,
      };
    default:
      return { title: "Failed to Start Review", message: error.message };
  }
}

export type ReviewStreamErrorKind = "api-key" | "transport" | "other";

export interface ReviewStreamErrorGuidance {
  kind: ReviewStreamErrorKind;
  title: string;
  guidance: string;
  ctaLabel: string;
}

const API_KEY_ERROR_PATTERN = /api.?key/i;

export function classifyReviewStreamError(
  error: string,
  errorCode?: string | null,
): ReviewStreamErrorGuidance {
  if (errorCode === ErrorCode.API_KEY_MISSING) {
    return {
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: CONFIGURE_PROVIDER_LABEL,
    };
  }
  if (errorCode === ErrorCode.STREAM_ERROR) {
    return {
      kind: "transport",
      title: "Connection Lost",
      guidance: "The review stream was interrupted. Retry to reconnect to the active review.",
      ctaLabel: "Retry",
    };
  }
  if (errorCode == null && API_KEY_ERROR_PATTERN.test(error)) {
    return {
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: CONFIGURE_PROVIDER_LABEL,
    };
  }
  return {
    kind: "other",
    title: "Review Error",
    guidance: "Return home and start a new review.",
    ctaLabel: "Back to Home",
  };
}
