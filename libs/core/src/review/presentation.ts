import type { SetupStatus } from "../schemas/config/index.js";
import type { AgentState, AgentStatus, LensStat } from "../schemas/events/index.js";
import type { FixPlanStep, ReviewIssue, ReviewMode } from "../schemas/review/index.js";
import { pluralize } from "../strings.js";
import type { DetailsEmptyKind } from "./details-empty.js";

export interface ReviewEmptyCopy {
  title: string;
  description?: string;
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
  };
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
