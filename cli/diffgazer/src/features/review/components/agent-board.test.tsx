import type { AgentState } from "@diffgazer/core/schemas/events";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { AgentBoard } from "./agent-board";

afterEach(() => {
  cleanup();
});

function makeAgent(overrides: Partial<AgentState>): AgentState {
  return {
    id: overrides.id ?? "agent-1",
    meta: {
      id: "detective",
      lens: "correctness",
      name: "Agent",
      badgeLabel: "AG",
      badgeVariant: "info",
      description: "desc",
      ...overrides.meta,
    },
    status: overrides.status ?? "queued",
    progress: overrides.progress ?? 0,
    currentAction: overrides.currentAction ?? "Standing by",
    issueCount: overrides.issueCount ?? 0,
  } as AgentState;
}

describe("AgentBoard (TUI)", () => {
  test("renders the shared agent status badges", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <AgentBoard
          agents={[
            makeAgent({ id: "detective", status: "queued" }),
            makeAgent({ id: "guardian", status: "running" }),
            makeAgent({ id: "optimizer", status: "complete" }),
            makeAgent({ id: "simplifier", status: "error" }),
          ]}
        />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("WAIT");
    expect(frame).toContain("RUN");
    expect(frame).toContain("DONE");
    expect(frame).toContain("FAIL");
  });
});
