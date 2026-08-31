import { describe, expect, it } from "vitest";
import { AGENT_METADATA, type AgentState, type LensStat } from "../../schemas/events/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import {
  AGENT_STATUS_META,
  buildCompletionHeadline,
  buildDroppedFindingsNotice,
  buildIncompleteAnswerNotice,
  buildLensFailureNotice,
  buildMissingLensIssuesNotice,
  buildTerminalCoverageLine,
  getAgentStatusMeta,
  getLensCoverage,
  getPartialFailureWarning,
  hasCompletedLens,
  hasFailedLenses,
  isAgentHeartbeatEvent,
  PERSISTED_RUN_ERROR_CODES,
  savedRunExists,
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
  };
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

describe("buildCompletionHeadline", () => {
  it("headlines a run with a failed lens as partially complete", () => {
    expect(
      buildCompletionHeadline([
        { lensId: "correctness", issueCount: 4, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed" },
      ]),
    ).toBe("Review Partially Complete");
  });

  it("headlines a fully reported run — or one without lens stats — as complete", () => {
    expect(
      buildCompletionHeadline([{ lensId: "security", issueCount: 2, status: "success" }]),
    ).toBe("Review Complete");
    expect(buildCompletionHeadline(undefined)).toBe("Review Complete");
  });

  it("headlines a run with an incompletely-answered lens as partially complete", () => {
    expect(
      buildCompletionHeadline([
        { lensId: "correctness", issueCount: 4, status: "success" },
        { lensId: "security", issueCount: 3, status: "success", droppedCandidateCount: 4 },
      ]),
    ).toBe("Review Partially Complete");
  });
});

describe("buildIncompleteAnswerNotice", () => {
  it("counts the dropped candidates and the incomplete answers they came from", () => {
    expect(
      buildIncompleteAnswerNotice([
        { lensId: "correctness", issueCount: 4, status: "success" },
        { lensId: "security", issueCount: 3, status: "success", droppedCandidateCount: 4 },
      ]),
    ).toBe("4 candidate findings dropped from 1 incomplete lens answer — rerun for a whole answer");
  });

  it("sums the drops across every incomplete answer", () => {
    expect(
      buildIncompleteAnswerNotice([
        { lensId: "correctness", issueCount: 1, status: "success", droppedCandidateCount: 4 },
        { lensId: "security", issueCount: 3, status: "success", droppedCandidateCount: 2 },
        { lensId: "tests", issueCount: 2, status: "success" },
      ]),
    ).toBe(
      "6 candidate findings dropped from 2 incomplete lens answers — rerun for a whole answer",
    );
  });

  it("says nothing when every lens answered in full", () => {
    expect(
      buildIncompleteAnswerNotice([{ lensId: "security", issueCount: 2, status: "success" }]),
    ).toBeNull();
    expect(buildIncompleteAnswerNotice(undefined)).toBeNull();
  });
});

describe("hasFailedLenses", () => {
  it("is true once any lens failed and false for a clean or absent report", () => {
    expect(
      hasFailedLenses([
        { lensId: "correctness", issueCount: 4, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed" },
      ]),
    ).toBe(true);
    expect(hasFailedLenses([{ lensId: "security", issueCount: 2, status: "success" }])).toBe(false);
    expect(hasFailedLenses(undefined)).toBe(false);
  });
});

describe("buildMissingLensIssuesNotice", () => {
  it("names the lenses whose issues are missing, without restating the ratio", () => {
    expect(
      buildMissingLensIssuesNotice([
        { lensId: "correctness", issueCount: 4, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed" },
        { lensId: "tests", issueCount: 0, status: "failed" },
      ]),
    ).toBe("Issues from Guardian and Tester are missing.");
  });

  it("says nothing when every lens reported", () => {
    expect(
      buildMissingLensIssuesNotice([{ lensId: "security", issueCount: 2, status: "success" }]),
    ).toBe("");
    expect(buildMissingLensIssuesNotice(undefined)).toBe("");
  });
});

describe("buildDroppedFindingsNotice", () => {
  it("tells the reader the lens counts outlived the findings", () => {
    expect(buildDroppedFindingsNotice("transport-failed")).toBe(
      "Findings are not kept for a run that ended this way; the counts below are what each lens reported before it ended.",
    );
  });

  it("says nothing for an outcome whose findings the server kept", () => {
    expect(buildDroppedFindingsNotice("budget-exhausted")).toBe("");
    expect(buildDroppedFindingsNotice(undefined)).toBe("");
  });
});

describe("hasCompletedLens", () => {
  it("counts a lens that reported nothing as completed", () => {
    expect(hasCompletedLens([{ lensId: "security", issueCount: 0, status: "success" }])).toBe(true);
  });

  it("is false when no lens reported", () => {
    expect(hasCompletedLens([{ lensId: "security", issueCount: 0, status: "failed" }])).toBe(false);
    expect(hasCompletedLens([])).toBe(false);
    expect(hasCompletedLens(undefined)).toBe(false);
  });
});

describe("getLensCoverage", () => {
  it("counts the lenses that reported out of the lenses the run tracked", () => {
    expect(
      getLensCoverage([
        { lensId: "correctness", issueCount: 4, status: "success" },
        { lensId: "security", issueCount: 0, status: "success" },
        { lensId: "tests", issueCount: 0, status: "failed" },
      ]),
    ).toEqual({ completed: 2, total: 3 });
  });

  it("reports no coverage when the run never tracked a lens", () => {
    expect(getLensCoverage(undefined)).toEqual({ completed: 0, total: 0 });
    expect(getLensCoverage([])).toEqual({ completed: 0, total: 0 });
  });
});

describe("buildTerminalCoverageLine", () => {
  it("leads with coverage, then the findings and the elapsed time", () => {
    expect(
      buildTerminalCoverageLine({
        coverage: { completed: 2, total: 5 },
        issueCount: 3,
        durationMs: 64_000,
      }),
    ).toBe("2 of 5 lenses completed · 3 issues · 1m 4s");
  });

  it("omits the elapsed time when the run recorded none", () => {
    expect(buildTerminalCoverageLine({ coverage: { completed: 1, total: 1 }, issueCount: 0 })).toBe(
      "1 of 1 lens completed · 0 issues",
    );
  });

  it("states the coverage of a run the caller derived from lens stats", () => {
    const lensStats: LensStat[] = [
      { lensId: "correctness", issueCount: 3, status: "success" },
      { lensId: "security", issueCount: 0, status: "failed" },
    ];

    expect(buildTerminalCoverageLine({ coverage: getLensCoverage(lensStats), issueCount: 3 })).toBe(
      "1 of 2 lenses completed · 3 issues",
    );
  });
});

describe("PERSISTED_RUN_ERROR_CODES", () => {
  it("lists every code the server reports only after it saved the run", () => {
    expect(PERSISTED_RUN_ERROR_CODES).toEqual([
      ReviewErrorCode.BUDGET_EXHAUSTED,
      ReviewErrorCode.MODEL_INCOMPATIBLE,
      ReviewErrorCode.PROVIDER_REJECTED,
      ReviewErrorCode.AI_ERROR,
    ]);
  });

  it("leaves out the failures that settle before the write", () => {
    expect(PERSISTED_RUN_ERROR_CODES).not.toContain(ReviewErrorCode.CANCELLED);
    expect(PERSISTED_RUN_ERROR_CODES).not.toContain(ReviewErrorCode.SESSION_NOT_FOUND);
    expect(PERSISTED_RUN_ERROR_CODES).not.toContain(ReviewErrorCode.INTERNAL_ERROR);
  });
});

describe("savedRunExists", () => {
  const completed: LensStat[] = [{ lensId: "security", issueCount: 0, status: "success" }];

  it("is true once a lens reported and the run failed after the save", () => {
    expect(savedRunExists(completed, ReviewErrorCode.AI_ERROR)).toBe(true);
  });

  it("is false for a transport error, which never reaches the save", () => {
    expect(savedRunExists(completed, "STREAM_ERROR")).toBe(false);
  });

  it("is false when no lens reported, so there is nothing to open", () => {
    expect(
      savedRunExists(
        [{ lensId: "security", issueCount: 0, status: "failed" }],
        ReviewErrorCode.AI_ERROR,
      ),
    ).toBe(false);
  });

  it("is false without an error code", () => {
    expect(savedRunExists(completed, null)).toBe(false);
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
