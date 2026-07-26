import { describe, expect, it } from "vitest";
import { AGENT_METADATA, type AgentState, type LensStat } from "../../schemas/events/index.js";
import {
  AGENT_STATUS_META,
  buildLensFailureNotice,
  getAgentStatusMeta,
  getPartialFailureWarning,
  isAgentHeartbeatEvent,
} from "./agent-status.js";

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

describe("buildLensFailureNotice", () => {
  it("says nothing when every lens reported", () => {
    expect(
      buildLensFailureNotice([{ lensId: "security", issueCount: 2, status: "success" }], 5),
    ).toBe("");
    expect(buildLensFailureNotice(undefined, 5)).toBe("");
  });

  it("names the lenses whose issues are missing", () => {
    expect(
      buildLensFailureNotice(
        [
          { lensId: "correctness", issueCount: 4, status: "success" },
          { lensId: "security", issueCount: 0, status: "failed" },
          { lensId: "performance", issueCount: 0, status: "failed" },
          { lensId: "tests", issueCount: 0, status: "failed" },
        ],
        5,
      ),
    ).toBe(
      "Partial run — 3 of 5 lenses failed. Issues from Guardian, Optimizer and Tester are missing.",
    );
  });

  it("attributes the failure to rate limiting only when every lens hit it", () => {
    const rateLimited: LensStat[] = [
      { lensId: "security", issueCount: 0, status: "failed", errorCode: "RATE_LIMITED" },
    ];
    expect(buildLensFailureNotice(rateLimited, 5)).toContain("(rate limited)");
    expect(
      buildLensFailureNotice(
        [...rateLimited, { lensId: "performance", issueCount: 0, status: "failed" }],
        5,
      ),
    ).not.toContain("rate limited");
  });

  it("counts the reported lenses when the caller gives no total", () => {
    expect(
      buildLensFailureNotice([
        { lensId: "correctness", issueCount: 1, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed" },
      ]),
    ).toBe("Partial run — 1 of 2 lenses failed. Issues from Guardian are missing.");
  });
});

describe("isAgentHeartbeatEvent", () => {
  const timestamp = "2026-01-01T00:00:00.000Z";

  it("treats agent progress pings as heartbeats", () => {
    expect(
      isAgentHeartbeatEvent({
        type: "agent_progress",
        agent: "guardian",
        progress: 65,
        message: "Waiting for model response",
        timestamp,
      }),
    ).toBe(true);
  });

  it("keeps events that record something happening", () => {
    expect(
      isAgentHeartbeatEvent({
        type: "agent_thinking",
        agent: "guardian",
        thought: "Reading auth middleware",
        timestamp,
      }),
    ).toBe(false);
    expect(
      isAgentHeartbeatEvent({
        type: "agent_complete",
        agent: "guardian",
        issueCount: 0,
        timestamp,
      }),
    ).toBe(false);
  });
});
