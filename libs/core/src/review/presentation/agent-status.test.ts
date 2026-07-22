import { describe, expect, it } from "vitest";
import { AGENT_METADATA, type AgentState } from "../../schemas/events/index.js";
import { AGENT_STATUS_META, getAgentStatusMeta, getPartialFailureWarning } from "./agent-status.js";

function makeAgent(
  name: string,
  status: AgentState["status"],
  id: AgentState["id"] = "guardian",
): AgentState {
  return {
    id,
    meta: {
      ...AGENT_METADATA[id],
      name,
    },
    status,
    progress: 0,
    issueCount: 0,
  } as AgentState;
}

describe("review agent-status presentation", () => {
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
    const agents = [
      makeAgent("Detective", "complete", "detective"),
      makeAgent("Guardian", "error"),
    ];

    expect(getPartialFailureWarning(agents, null)).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed: Guardian. Results may be incomplete.",
    });
    expect(
      getPartialFailureWarning(agents, null, [
        {
          lensId: "security",
          issueCount: 0,
          status: "failed",
          errorCode: "MODEL_ERROR",
        },
      ]),
    ).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed: Guardian. Results may be incomplete.",
    });
    expect(
      getPartialFailureWarning(agents, null, [
        {
          lensId: "security",
          issueCount: 0,
          status: "failed",
          errorCode: "RATE_LIMITED",
        },
      ]),
    ).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed (rate limited): Guardian. Results may be incomplete.",
    });
    expect(getPartialFailureWarning(agents, "Run failed").hasPartialFailure).toBe(false);
    expect(
      getPartialFailureWarning([makeAgent("Detective", "complete")], null).hasPartialFailure,
    ).toBe(false);
  });

  it("uses the generic warning when any failed lens was not explicitly rate limited", () => {
    const agents = [
      makeAgent("Detective", "error", "detective"),
      makeAgent("Guardian", "error", "guardian"),
    ];

    expect(
      getPartialFailureWarning(agents, null, [
        {
          lensId: "correctness",
          issueCount: 0,
          status: "failed",
          errorCode: "RATE_LIMITED",
        },
        {
          lensId: "security",
          issueCount: 0,
          status: "failed",
          errorCode: "MODEL_ERROR",
        },
      ]).message,
    ).toBe("2 agents failed: Detective, Guardian. Results may be incomplete.");
  });
});
