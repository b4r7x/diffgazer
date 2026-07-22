import type { AgentState } from "@diffgazer/core/schemas/events";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { AgentBoard } from "./agent-board";

afterEach(() => {
  cleanup();
});

function makeAgent(
  overrides: Partial<Omit<AgentState, "meta">> & { meta?: Partial<AgentState["meta"]> },
): AgentState {
  return {
    id: overrides.id ?? "detective",
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
  };
}

describe("AgentBoard (TUI)", () => {
  test("renders a running agent with name, RUN badge, detail, and spinner", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <AgentBoard
          agents={[
            makeAgent({
              status: "running",
              meta: { name: "Detective", badgeLabel: "DT" },
              progress: 42,
              currentAction: "Reading file",
            }),
          ]}
        />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Detective");
    expect(frame).toContain("RUN");
    expect(frame).toContain("42% Reading file");
    expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣾⣽⣻⢿⡿⣟⣯⣷]/);
  });

  test("caps visible agents by maxRows and reports the remaining overflow count", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <AgentBoard
          agents={[
            makeAgent({ id: "detective", meta: { name: "Detective" } }),
            makeAgent({ id: "guardian", meta: { name: "Sentinel" } }),
            makeAgent({ id: "optimizer", meta: { name: "Archivist" } }),
            makeAgent({ id: "simplifier", meta: { name: "Courier" } }),
          ]}
          maxRows={2}
        />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Detective");
    expect(frame).not.toContain("Sentinel");
    expect(frame).not.toContain("Archivist");
    expect(frame).not.toContain("Courier");
    expect(frame).toContain("… 3 more agents");
  });
});
