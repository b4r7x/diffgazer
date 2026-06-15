import type { AgentState, AgentStatus } from "../schemas/events/index.js";
import type { ReviewMode } from "../schemas/review/index.js";
import { pluralize } from "../strings.js";
import type { DetailsEmptyKind } from "./details-empty.js";

export interface ReviewEmptyCopy {
  title: string;
  description?: string;
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
  agents: AgentState[],
  error: string | null,
): PartialFailureWarning {
  const failedAgents = agents.filter((agent) => agent.status === "error");
  const hasPartialFailure = failedAgents.length > 0 && !error;
  const failedAgentNames = failedAgents.map((agent) => agent.meta.name).join(", ");
  return {
    hasPartialFailure,
    message: `${pluralize(failedAgents.length, "agent")} failed (likely rate limited): ${failedAgentNames}. Results may be incomplete.`,
  };
}

export interface ApiKeyMissingCopy {
  title: string;
  body: string;
}

/**
 * Variant-aware copy for the missing-provider gate: a missing model vs a missing
 * API key, each interpolating the active provider when known.
 */
export function getApiKeyMissingCopy(input: {
  provider?: string;
  missingModel: boolean;
}): ApiKeyMissingCopy {
  const forProvider = input.provider ? ` for ${input.provider}` : "";
  if (input.missingModel) {
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
