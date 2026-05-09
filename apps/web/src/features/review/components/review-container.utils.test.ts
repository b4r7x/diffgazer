import { describe, it, expect } from "vitest";
import { mapStepsToProgressData } from "./review-container.utils";
import type { StepState, AgentState } from "@diffgazer/core/schemas/events";

function makeStep(id: StepState["id"], label: string, status: StepState["status"] = "pending"): StepState {
  return { id, label, status };
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  const agent: AgentState = {
    id: "agent-1",
    meta: { id: "agent-1", name: "Security", badgeLabel: "SEC", lensId: "security" },
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: "Queued",
    startedAt: undefined,
    completedAt: undefined,
    ...overrides,
  };
  return agent;
}

describe("mapStepsToProgressData", () => {
  it("maps steps to progress data", () => {
    const steps = [makeStep("parse", "Parsing", "completed"), makeStep("review", "Reviewing", "active")];
    const result = mapStepsToProgressData(steps, []);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "parse", label: "Parsing", status: "completed", substeps: undefined });
    expect(result[1]).toEqual({ id: "review", label: "Reviewing", status: "active", substeps: undefined });
  });

  it("handles empty steps array", () => {
    expect(mapStepsToProgressData([], [])).toEqual([]);
  });

  it("maps step error status to pending", () => {
    const steps = [makeStep("parse", "Parsing", "error")];
    const result = mapStepsToProgressData(steps, []);
    expect(result[0]?.status).toBe("pending");
  });

  it("should derive substeps from agents for review step", () => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [makeAgent({ id: "a1", status: "running", progress: 50, currentAction: "Analyzing" })];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps).toHaveLength(1);
    expect(result[0]?.substeps?.[0]?.status).toBe("active");
  });

  it("does not add substeps for non-review steps", () => {
    const steps = [makeStep("parse", "Parsing", "active")];
    const agents = [makeAgent()];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps).toBeUndefined();
  });

  it.each([
    ["queued", "pending"],
    ["running", "active"],
    ["complete", "completed"],
    ["error", "error"],
  ] as const)("maps %s agents to %s substeps", (agentStatus, substepStatus) => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const result = mapStepsToProgressData(steps, [makeAgent({ status: agentStatus })]);
    expect(result[0]?.substeps?.[0]?.status).toBe(substepStatus);
  });

  it.each([
    [5, "5 issues"],
    [1, "1 issue"],
  ])("shows completed agent issue count %i as %s", (issueCount, detail) => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [makeAgent({ status: "complete", issueCount })];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps?.[0]?.detail).toBe(detail);
  });

  it("includes progress and current action for running agents", () => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [makeAgent({ status: "running", progress: 75, currentAction: "Reading file" })];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps?.[0]?.detail).toContain("75%");
    expect(result[0]?.substeps?.[0]?.detail).toContain("Reading file");
  });
});
