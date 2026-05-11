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
  it("maps workflow steps and review agents into progress rows", () => {
    const steps = [
      makeStep("diff", "Collect diff", "completed"),
      makeStep("review", "Review issues", "active"),
    ];
    const agents: AgentState[] = [
      makeAgent({ id: "queued-agent", status: "queued" }),
      makeAgent({ id: "running-agent", status: "running", progress: 75, currentAction: "Reading file" }),
      makeAgent({ id: "complete-agent", status: "complete", issueCount: 1 }),
      makeAgent({ id: "error-agent", status: "error" }),
    ];

    const result = mapStepsToProgressData(steps, agents);

    expect(result[0]).toEqual({
      id: "diff",
      label: "Collect diff",
      status: "completed",
      substeps: undefined,
    });
    expect(result[1]?.substeps?.map((substep) => substep.status)).toEqual([
      "pending",
      "active",
      "completed",
      "error",
    ]);
    expect(result[1]?.substeps?.[1]?.detail).toContain("75%");
    expect(result[1]?.substeps?.[1]?.detail).toContain("Reading file");
    expect(result[1]?.substeps?.[2]?.detail).toBe("1 issue");
  });

  it("keeps non-review steps free of agent substeps and hides top-level errors from the progress UI", () => {
    const steps = [
      makeStep("context", "Project context", "error"),
      makeStep("enrich", "Enrich context", "active"),
    ];

    const result = mapStepsToProgressData(steps, [makeAgent()]);

    expect(result).toEqual([
      { id: "context", label: "Project context", status: "pending", substeps: undefined },
      { id: "enrich", label: "Enrich context", status: "active", substeps: undefined },
    ]);
  });
});
