import { buildHistoryRunSummary } from "@diffgazer/core/review";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { RunsList } from "./runs-list";

afterEach(() => {
  cleanup();
});

describe("RunsList", () => {
  test("renders distinct run labels when loaded ids share the minimum prefix", () => {
    const metadata = [
      makeReviewMetadata({ id: "abcdef00-0000-4000-8000-000000000000" }),
      makeReviewMetadata({ id: "abcdef00-1000-4000-8000-000000000000" }),
    ];
    const peerIds = metadata.map((run) => run.id);
    const displayIds = ["#abcdef00-0", "#abcdef00-1"];
    const runs = metadata.map((run, index) => ({
      ...buildHistoryRunSummary(run, peerIds),
      displayId: displayIds[index] ?? "#unexpected",
    }));
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={runs}
          selectedId={runs[0]?.id ?? null}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={8}
          width={80}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("#abcdef00-0");
    expect(frame).toContain("#abcdef00-1");
  });

  test("renders partial analysis instead of a pass for a zero-issue failed-lens run", () => {
    const run = buildHistoryRunSummary(makeReviewMetadata({ issueCount: 0, failedLensCount: 1 }));
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[run]}
          selectedId={run.id}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={6}
          width={80}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Partial analysis: 1 lens failed; no issues found.");
    expect(frame).not.toContain("Passed with no issues.");
  });

  test("keeps keyboard highlight visible while rendering a bounded run window", async () => {
    const runs = Array.from({ length: 12 }, (_, index) => ({
      id: `run-${index}`,
      displayId: `#${index.toString().padStart(4, "0")}`,
      branch: `branch-${index}`,
      timestamp: `${index}:00`,
      summary: `Summary ${index}`,
    }));

    function Harness() {
      const [selectedId, setSelectedId] = useState(runs[0]?.id ?? null);
      return (
        <CliThemeProvider initialTheme="dark">
          <RunsList
            runs={runs}
            selectedId={selectedId}
            onSelect={vi.fn()}
            onHighlightChange={setSelectedId}
            emptyMessage="No runs"
            height={6}
            width={25}
          />
        </CliThemeProvider>
      );
    }

    const { lastFrame, stdin } = render(<Harness />);
    await flush();
    expect(lastFrame()).toContain("Summary 0");
    expect(lastFrame()).not.toContain("Summary 2");

    for (let index = 0; index < 4; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Summary 4");
    expect(frame).not.toContain("Summary 0");
    expect(frame.split("\n").filter(Boolean)).toHaveLength(4);
    expect(frame.split("\n").every((line) => line.length <= 25)).toBe(true);
  });

  test("shows the older-runs shortcut while another cursor page is available", () => {
    const run = buildHistoryRunSummary(makeReviewMetadata());
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[run]}
          selectedId={run.id}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={6}
          width={25}
          hasMore
        />
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("Load older runs");
  });

  test("keeps older pages reachable when the current filter has no matching runs", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[]}
          selectedId={null}
          onSelect={vi.fn()}
          emptyMessage="No matching runs"
          height={4}
          width={25}
          hasMore
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain("No matching runs");
    expect(frame).toContain("Load older runs");
    expect(frame.split("\n").filter(Boolean)).toHaveLength(2);
  });

  test("truncates long run fields without spending extra terminal rows", async () => {
    const runs = Array.from({ length: 6 }, (_, index) => ({
      id: `run-${index}`,
      displayId: `#${index.toString().padStart(4, "0")}`,
      branch: `feature/extremely-long-branch-${index}-TAIL`,
      timestamp: "12/31/2026, 11:59:59 PM",
      summary: `Summary ${index} with a long explanation that must not wrap TAIL`,
    }));

    function Harness() {
      const [selectedId, setSelectedId] = useState(runs[0]?.id ?? null);
      return (
        <CliThemeProvider initialTheme="dark">
          <RunsList
            runs={runs}
            selectedId={selectedId}
            onSelect={vi.fn()}
            onHighlightChange={setSelectedId}
            emptyMessage="No runs"
            height={6}
            width={25}
          />
        </CliThemeProvider>
      );
    }

    const { lastFrame, stdin } = render(<Harness />);
    for (let index = 0; index < 4; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const lines = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(lines.join("\n")).toContain("Summary 4");
    expect(lines.join("\n")).not.toContain("TAIL");
    expect(lines).toHaveLength(4);
    expect(lines.every((line) => line.length <= 25)).toBe(true);
  });

  test("keeps the selected run id visible in a one-row viewport", () => {
    const run = buildHistoryRunSummary(makeReviewMetadata({ id: "selected-run" }));
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[run]}
          selectedId={run.id}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={1}
          width={25}
          hasMore
        />
      </CliThemeProvider>,
    );

    const lines = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(run.displayId);
    expect(lines[0]).not.toContain("Load older runs");
    expect(lines[0]?.length).toBeLessThanOrEqual(25);
  });
});

async function flush(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
