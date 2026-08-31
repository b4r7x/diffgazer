import { buildRunIdLookup } from "@diffgazer/core/format";
import { buildHistoryRunSummary } from "@diffgazer/core/review";
import { makeReviewMetadata } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
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
    const peerLookup = buildRunIdLookup(metadata.map((run) => run.id));
    const displayIds = ["#abcdef00-0", "#abcdef00-1"];
    const runs = metadata.map((run, index) => ({
      ...buildHistoryRunSummary(run, peerLookup),
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

  test("selects the highlighted run's id exactly once on Return", async () => {
    const onSelect = vi.fn();
    const run = buildHistoryRunSummary(makeReviewMetadata({ id: "selected-run" }));
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[run]}
          selectedId={run.id}
          onSelect={onSelect}
          emptyMessage="No runs"
          height={6}
          width={25}
        />
      </CliThemeProvider>,
    );

    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(run.id);
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
    const topRows = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(topRows.join("\n")).toContain("Summary 0");
    expect(topRows.at(-1)).toContain("\u25BC");
    expect(topRows.length).toBeLessThanOrEqual(6);

    for (let index = 0; index < 4; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const frame = lastFrame() ?? "";
    const middleRows = frame.split("\n").filter(Boolean);
    expect(frame).toContain("Summary 4");
    expect(frame).not.toContain("Summary 0");
    expect(middleRows[0]).toContain("\u25B2");
    expect(frame).toContain("\u25BC");
    expect(middleRows.length).toBeLessThanOrEqual(6);
    expect(frame.split("\n").every((line) => line.length <= 25)).toBe(true);

    for (let index = 0; index < 7; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const bottomRows = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(bottomRows[0]).toContain("\u25B2");
    expect(bottomRows.join("\n")).toContain("Summary 11");
    expect(bottomRows.length).toBeLessThanOrEqual(6);
  });

  test("spends rows on runs instead of scroll carets that never render", () => {
    const runs = Array.from({ length: 2 }, (_, index) => ({
      id: `run-${index}`,
      displayId: `#000${index}`,
      branch: `branch-${index}`,
      timestamp: `${index}:00`,
      summary: `Summary ${index}`,
    }));
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={runs}
          selectedId={runs[0]?.id ?? null}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={6}
          width={32}
        />
      </CliThemeProvider>,
    );

    // Both runs fit in the four content rows history gives this pane, so the
    // list must not reserve caret rows it has nothing to draw in.
    const frame = lastFrame() ?? "";
    expect(frame).toContain("#0000");
    expect(frame).toContain("#0001");
    expect(frame).not.toContain("▼");
    expect(frame).not.toContain("▲");
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
    expect(lines.length).toBeLessThanOrEqual(6);
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

  test("keeps canonical collision labels and salvage markers visible in a tight pane", () => {
    const sharedPrefix = "123456789012345678901234567890";
    const metadata = [
      makeReviewMetadata({ id: `${sharedPrefix}0-4000-8000-000000000000` }),
      makeReviewMetadata({ id: `${sharedPrefix}1-4000-8000-000000000000` }),
    ];
    const peerLookup = buildRunIdLookup(metadata.map((review) => review.id));
    const runs = metadata.map((review) => buildHistoryRunSummary(review, peerLookup));
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={runs}
          selectedId={runs[0]?.id ?? null}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={5}
          width={38}
          droppedIssueRunIds={new Set([runs[0]?.id ?? ""])}
        />
      </CliThemeProvider>,
    );

    const lines = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(lines).toHaveLength(4);
    expect(lines.every((line) => line.length <= 38)).toBe(true);
    expect(lines.join("\n")).toContain("[Omitted]");
    expect(lines.join("\n")).toContain(runs[0]?.displayId ?? "");
    expect(lines.join("\n")).toContain(runs[1]?.displayId ?? "");
    expect(lines.join("\n")).not.toContain("…");
    const runLines = lines.filter((line) => line.includes("#123456789012345678901234567890"));
    expect(runLines).toHaveLength(2);
    expect(runLines[0]).not.toBe(runLines[1]);
  });

  test("keeps a single salvaged canonical id searchable beside a warning-only collider", () => {
    const visibleId = "12345678-1234-4123-8123-123456789000";
    const warningOnlyId = "12345678-1234-4123-8123-123456789001";
    const run = buildHistoryRunSummary(
      makeReviewMetadata({ id: visibleId }),
      buildRunIdLookup([visibleId, warningOnlyId]),
    );
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[run]}
          selectedId={run.id}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={3}
          width={38}
          droppedIssueRunIds={new Set([visibleId])}
        />
      </CliThemeProvider>,
    );

    const frame = lastFrame() ?? "";
    expect(frame).toContain(run.displayId);
    expect(frame).toContain("[Omitted]");
    expect(frame).not.toContain("…");
  });

  test("escapes bidi formatting controls in branch labels", () => {
    const run = {
      ...buildHistoryRunSummary(makeReviewMetadata({ id: "bidi-run", branch: "main\u202Eevil" })),
      displayId: "#bidi",
      timestamp: "12:00",
      summary: "Summary",
    };
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <RunsList
          runs={[run]}
          selectedId={run.id}
          onSelect={vi.fn()}
          emptyMessage="No runs"
          height={4}
          width={40}
        />
      </CliThemeProvider>,
    );

    expect(lastFrame() ?? "").toContain("[main\\u202eevil]");
    expect(lastFrame() ?? "").not.toContain("\u202E");
  });
});
