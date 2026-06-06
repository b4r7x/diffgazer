import { describe, expect, it } from "vitest";
import type { AgentState, StepState } from "../schemas/events/index.js";
import { getAgentDetail, mapStepStatus } from "./display.js";

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: "a",
    meta: {
      id: "a",
      lensId: "security",
      name: "Agent",
      badgeLabel: "AG",
      badgeVariant: "info",
      description: "",
    },
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: undefined,
    ...overrides,
  } as AgentState;
}

describe("mapStepStatus", () => {
  it.each<[StepState["status"], string]>([
    ["active", "running"],
    ["completed", "complete"],
    ["error", "error"],
    ["pending", "pending"],
  ])("maps %s to %s", (input, expected) => {
    expect(mapStepStatus(input)).toBe(expected);
  });
});

describe("getAgentDetail", () => {
  it("shows percentage with the current action when running", () => {
    expect(
      getAgentDetail(makeAgent({ status: "running", progress: 42, currentAction: "Reading file" })),
    ).toBe("42% Reading file");
  });

  it("shows percentage only when no current action is reported", () => {
    expect(getAgentDetail(makeAgent({ status: "running", progress: 75 }))).toBe("75%");
  });

  it("pluralizes the issue count when complete", () => {
    expect(getAgentDetail(makeAgent({ status: "complete", issueCount: 0 }))).toBe(
      "0 issues",
    );
    expect(getAgentDetail(makeAgent({ status: "complete", issueCount: 1 }))).toBe(
      "1 issue",
    );
    expect(getAgentDetail(makeAgent({ status: "complete", issueCount: 5 }))).toBe(
      "5 issues",
    );
  });

  it("returns the literal 'error' for failed agents", () => {
    expect(getAgentDetail(makeAgent({ status: "error" }))).toBe("error");
  });

  it("returns 'queued' for agents that have not started", () => {
    expect(getAgentDetail(makeAgent({ status: "queued" }))).toBe("queued");
  });
});
