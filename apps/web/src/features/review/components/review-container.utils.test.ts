import { describe, it, expect } from "vitest";
import { mapStepsToProgressData } from "./review-container.utils";
import type { StepState, AgentState } from "@diffgazer/schemas/events";

function makeStep(id: string, label: string, status: StepState["status"] = "pending"): StepState {
  return { id, label, status } as StepState;
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: "agent-1",
    meta: { id: "agent-1", name: "Security", badgeLabel: "SEC", lensId: "security" },
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: "Queued",
    startedAt: undefined,
    completedAt: undefined,
    ...overrides,
  } as AgentState;
}

describe("mapStepsToProgressData", () => {
  it("should map steps to progress data", () => {
    const steps = [makeStep("parse", "Parsing", "completed"), makeStep("review", "Reviewing", "active")];
    const result = mapStepsToProgressData(steps, []);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "parse", label: "Parsing", status: "completed", substeps: undefined });
    expect(result[1]).toEqual({ id: "review", label: "Reviewing", status: "active", substeps: undefined });
  });

  it("should handle empty steps array", () => {
    expect(mapStepsToProgressData([], [])).toEqual([]);
  });

  it("should map step error status to pending", () => {
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

  it("should not add substeps for non-review steps", () => {
    const steps = [makeStep("parse", "Parsing", "active")];
    const agents = [makeAgent()];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps).toBeUndefined();
  });

  it("should map agent statuses correctly", () => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [
      makeAgent({ id: "a1", status: "queued" }),
      makeAgent({ id: "a2", status: "running", progress: 50 }),
      makeAgent({ id: "a3", status: "complete", issueCount: 3 }),
      makeAgent({ id: "a4", status: "error" }),
    ];
    const result = mapStepsToProgressData(steps, agents);
    const substeps = result[0]?.substeps;
    expect(substeps?.[0]?.status).toBe("pending");
    expect(substeps?.[1]?.status).toBe("active");
    expect(substeps?.[2]?.status).toBe("completed");
    expect(substeps?.[3]?.status).toBe("error");
  });

  it("should include agent detail for running agents", () => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [makeAgent({ status: "running", progress: 75, currentAction: "Reading file" })];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps?.[0]?.detail).toContain("75%");
    expect(result[0]?.substeps?.[0]?.detail).toContain("Reading file");
  });

  it("should show issue count for completed agents", () => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [makeAgent({ status: "complete", issueCount: 5 })];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps?.[0]?.detail).toBe("5 issues");
  });

  it("should show singular issue for count of 1", () => {
    const steps = [makeStep("review", "Reviewing", "active")];
    const agents = [makeAgent({ status: "complete", issueCount: 1 })];
    const result = mapStepsToProgressData(steps, agents);
    expect(result[0]?.substeps?.[0]?.detail).toBe("1 issue");
  });
});
