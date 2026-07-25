import type { AgentState } from "@diffgazer/core/schemas/events";
import { Box } from "ink";
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

  test("spends a lone row on the running agent instead of an overflow count", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <AgentBoard
          agents={[
            makeAgent({ id: "detective", meta: { name: "Detective" } }),
            makeAgent({ id: "guardian", meta: { name: "Sentinel" } }),
            makeAgent({ id: "optimizer", status: "running", meta: { name: "Archivist" } }),
            makeAgent({ id: "simplifier", meta: { name: "Courier" } }),
          ]}
          maxRows={1}
        />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Archivist");
    expect(frame).not.toContain("Detective");
    expect(frame).not.toContain("more agents");
  });

  test("falls back to the first agent for a lone row when none is running", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <AgentBoard
          agents={[
            makeAgent({ id: "detective", meta: { name: "Detective" } }),
            makeAgent({ id: "guardian", meta: { name: "Sentinel" } }),
          ]}
          maxRows={1}
        />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Detective");
    expect(frame).not.toContain("Sentinel");
    expect(frame).not.toContain("more agents");
  });
});

describe("AgentBoard row clipping", () => {
  test("keeps a long agent detail on its own single row instead of wrapping into the next agent", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <Box width={40}>
          <AgentBoard
            agents={[
              makeAgent({
                id: "detective",
                status: "running",
                meta: { name: "Detective", badgeLabel: "DT" },
                progress: 62,
                currentAction:
                  "Reading a very long path that would otherwise wrap onto the next terminal row",
              }),
              makeAgent({
                id: "guardian",
                status: "queued",
                meta: { id: "guardian", name: "Guardian", badgeLabel: "GD" },
              }),
            ]}
          />
        </Box>
      </CliThemeProvider>,
    );
    const rows = (lastFrame() ?? "").split("\n");

    // Header, rule, spacer, one row per agent. A wrapping detail would add
    // rows here and push the board past the height its pane reserved for it.
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.includes("Detective"))).toHaveLength(1);
    expect(rows.some((row) => row.includes("otherwise wrap"))).toBe(false);
  });
});
