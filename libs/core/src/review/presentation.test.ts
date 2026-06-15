import { describe, expect, it } from "vitest";
import type { AgentState } from "../schemas/events/index.js";
import {
  AGENT_STATUS_META,
  DETAILS_EMPTY_COPY,
  getAgentStatusMeta,
  getApiKeyMissingCopy,
  getDetailsEmptyCopy,
  getNoChangesCopy,
  getPartialFailureWarning,
  NO_CHANGES_COPY,
} from "./presentation.js";

function makeAgent(name: string, status: AgentState["status"]): AgentState {
  return {
    id: "guardian",
    meta: {
      id: "guardian",
      lens: "security",
      name,
      badgeLabel: "AG",
      badgeVariant: "info",
      description: "",
    },
    status,
    progress: 0,
    issueCount: 0,
  } as AgentState;
}

describe("review presentation contracts", () => {
  it("keeps the shared issue-details empty copy", () => {
    expect(getDetailsEmptyCopy("no-issues")).toEqual({
      title: "No issues in this review",
      description: "This analysis passed without issues.",
    });
    expect(getDetailsEmptyCopy("filter-empty")).toEqual({
      title: "No issues match this filter",
      description: "Choose another severity to continue.",
    });
    expect(getDetailsEmptyCopy("no-selection")).toEqual({
      title: "Select an issue to view details",
    });
    expect(Object.keys(DETAILS_EMPTY_COPY)).toEqual(["no-issues", "filter-empty", "no-selection"]);
  });

  it("keeps the shared no-diff copy", () => {
    expect(getNoChangesCopy("staged")).toMatchObject({
      title: "No Staged Changes",
      switchLabel: "Review Unstaged",
    });
    expect(getNoChangesCopy("unstaged")).toMatchObject({
      title: "No Unstaged Changes",
      switchLabel: "Review Staged",
    });
    expect(getNoChangesCopy("files")).toMatchObject({
      title: "No Changes in Selected Files",
      switchLabel: "Review Unstaged",
    });
    expect(Object.keys(NO_CHANGES_COPY)).toEqual(["staged", "unstaged", "files"]);
  });

  it("keeps the shared agent status badge metadata", () => {
    expect(AGENT_STATUS_META).toEqual({
      queued: { label: "WAIT", variant: "neutral" },
      running: { label: "RUN", variant: "info" },
      complete: { label: "DONE", variant: "success" },
      error: { label: "FAIL", variant: "error" },
    });
    expect(getAgentStatusMeta("running")).toEqual({ label: "RUN", variant: "info" });
  });

  it("derives the partial-failure warning only when agents failed and no error is surfaced", () => {
    const agents = [makeAgent("Detective", "complete"), makeAgent("Guardian", "error")];

    expect(getPartialFailureWarning(agents, null)).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed (likely rate limited): Guardian. Results may be incomplete.",
    });
    // An active error takes precedence and suppresses the partial-failure warning.
    expect(getPartialFailureWarning(agents, "Run failed").hasPartialFailure).toBe(false);
    expect(
      getPartialFailureWarning([makeAgent("Detective", "complete")], null).hasPartialFailure,
    ).toBe(false);
  });

  it("produces variant-aware api-key-missing copy interpolating the provider", () => {
    expect(getApiKeyMissingCopy({ provider: "openai", missingModel: true })).toEqual({
      title: "Model Required",
      body: "No model selected for openai. Set up a model in Settings to start reviewing code.",
    });
    expect(getApiKeyMissingCopy({ provider: "openai", missingModel: false })).toEqual({
      title: "API Key Required",
      body: "No API key configured for openai. Add your API key in Settings to start reviewing code.",
    });
    expect(getApiKeyMissingCopy({ missingModel: false }).body).toBe(
      "No API key configured. Add your API key in Settings to start reviewing code.",
    );
  });
});
