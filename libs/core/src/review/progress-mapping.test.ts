import { describe, expect, it } from "vitest";
import { AGENT_METADATA, type AgentState, type StepState } from "../schemas/events/index.js";
import { mapStepsToProgressData, mapStepsToProgressDataWithAgents } from "./progress-mapping.js";

function makeStep(
  id: StepState["id"],
  label: string,
  status: StepState["status"] = "pending",
): StepState {
  return { id, label, status };
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  const id = overrides.id ?? "detective";
  return {
    status: "queued",
    progress: 0,
    issueCount: 0,
    currentAction: "Queued",
    startedAt: undefined,
    completedAt: undefined,
    ...overrides,
    id,
    meta: overrides.meta ?? AGENT_METADATA[id],
  } satisfies AgentState;
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
    expect(result[1]?.substeps).toEqual([
      { id: "detective", tag: "DET", label: "Detective", status: "pending", detail: "queued" },
      {
        id: "guardian",
        tag: "SEC",
        label: "Guardian",
        status: "active",
        detail: "75% · Reading file",
      },
      {
        id: "optimizer",
        tag: "PERF",
        label: "Optimizer",
        status: "completed",
        detail: "1 issue",
      },
      { id: "simplifier", tag: "SIM", label: "Simplifier", status: "error", detail: "error" },
    ]);
  });

  it("keeps non-review steps free of agent substeps and surfaces failed step status", () => {
    const steps = [
      makeStep("context", "Project context", "error"),
      makeStep("report", "Save results", "active"),
    ];

    const result = mapStepsToProgressDataWithAgents(steps, [makeAgent()]);

    expect(result).toEqual([
      { id: "context", label: "Project context", status: "error", substeps: undefined },
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
