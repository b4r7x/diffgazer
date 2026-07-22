import { describe, expect, it } from "vitest";
import type { AgentState, StepState } from "../schemas/events/index.js";
import { mapStepsToProgressData, mapStepsToProgressDataWithAgents } from "./progress-mapping.js";

function makeStep(
  id: StepState["id"],
  label: string,
  status: StepState["status"] = "pending",
): StepState {
  return { id, label, status };
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
  it("maps workflow steps and review agents into progress rows", () => {
    const steps = [
      makeStep("diff", "Collect diff", "completed"),
      makeStep("review", "Review issues", "active"),
    ];
    const agents: AgentState[] = [
      makeAgent({ id: "detective", status: "queued" }),
      makeAgent({ id: "guardian", status: "running", progress: 75, currentAction: "Reading file" }),
      makeAgent({ id: "optimizer", status: "complete", issueCount: 1 }),
      makeAgent({ id: "simplifier", status: "error" }),
    ];

    const result = mapStepsToProgressDataWithAgents(steps, agents);

    expect(result[0]).toEqual({
      id: "diff",
      label: "Collect diff",
      status: "completed",
      substeps: undefined,
    });
    expect(result[1]?.substeps?.[0]).toMatchObject({
      id: "detective",
      tag: "SEC",
      label: "Security",
    });
    expect(result[1]?.substeps).toEqual([
      { id: "detective", tag: "SEC", label: "Security", status: "pending", detail: "queued" },
      {
        id: "guardian",
        tag: "SEC",
        label: "Security",
        status: "active",
        detail: "75% · Reading file",
      },
      {
        id: "optimizer",
        tag: "SEC",
        label: "Security",
        status: "completed",
        detail: "1 issue",
      },
      { id: "simplifier", tag: "SEC", label: "Security", status: "error", detail: "error" },
    ]);
  });

  it("keeps non-review steps free of agent substeps and hides top-level errors from the progress UI", () => {
    const steps = [
      makeStep("context", "Project context", "error"),
      makeStep("report", "Save results", "active"),
    ];

    const result = mapStepsToProgressDataWithAgents(steps, [makeAgent()]);

    expect(result).toEqual([
      { id: "context", label: "Project context", status: "pending", substeps: undefined },
      { id: "report", label: "Save results", status: "active", substeps: undefined },
    ]);
  });

  it("maps base progress rows without an unused substep field", () => {
    const result = mapStepsToProgressData([
      makeStep("diff", "Collect diff", "completed"),
      makeStep("review", "Review issues", "active"),
    ]);

    expect(result).toEqual([
      { id: "diff", label: "Collect diff", status: "completed" },
      { id: "review", label: "Review issues", status: "active" },
    ]);
  });
});
