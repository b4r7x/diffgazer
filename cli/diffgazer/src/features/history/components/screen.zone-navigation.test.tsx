import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { HistoryRunSummary } from "@diffgazer/core/review";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { buildResponsiveResult, getBreakpointTier } from "../../../lib/breakpoints";
import { flush } from "../../../testing/flush";
import { CliThemeProvider } from "../../../theme/provider";
import { makeHistoryScreenState } from "../testing/screen-state";
import { HistoryScreen } from "./screen";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());
const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));

const UP = "\u001B[A";
const DOWN = "\u001B[B";
const RIGHT = "\u001B[C";
const LEFT = "\u001B[D";

const RUNS_FOOTER = "Tab Switch Pane | ↑/↓ Navigate | Enter Open Review | / Search";
const TIMELINE_FOOTER = "Tab Switch Pane | ↑/↓ Navigate | / Search";
const INSIGHTS_FOOTER = "Tab Switch Pane | Enter Open Review | / Search";
const SEARCH_FOOTER = "↓ Timeline";
const LOAD_MORE_FOOTER = "Tab Switch Pane | Enter Load Older Runs";

const RUNS: HistoryRunSummary[] = [
  {
    id: "run-1",
    displayId: "#run-1",
    branch: "main",
    timestamp: "now",
    summary: "First run",
  },
  {
    id: "run-2",
    displayId: "#run-2",
    branch: "main",
    timestamp: "now",
    summary: "Second run",
  },
];

vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: useHistoryScreenStateMock,
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    ...buildResponsiveResult(getBreakpointTier(terminalSize.columns)),
  }),
  useTerminalDimensions: () => terminalSize,
}));

vi.mock("../../../components/layout/global", () => ({
  useContentZone: () => ({
    columns: terminalSize.columns,
    contentColumns: terminalSize.columns,
    contentRows: terminalSize.rows - 4,
  }),
}));

function FooterProbe() {
  const { shortcuts } = useFooterData();
  return (
    <Text>{`Footer: ${shortcuts.map(({ key, label }) => `${key} ${label}`).join(" | ")}`}</Text>
  );
}

function renderHistoryScreen() {
  return render(
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <NavigationContext.Provider
          value={{
            route: { screen: "history" },
            navigate: vi.fn(),
            goBack: vi.fn(),
            canGoBack: true,
          }}
        >
          <HistoryScreen />
          <FooterProbe />
        </NavigationContext.Provider>
      </CliThemeProvider>
    </FooterProvider>,
  );
}

interface StatefulHistoryOptions {
  hasMoreReviews?: boolean;
  loadMoreReviews?: () => Promise<void>;
  setSearchQuery?: () => void;
}

function mockStatefulHistory({
  hasMoreReviews = false,
  loadMoreReviews = vi.fn(async () => {}),
  setSearchQuery = vi.fn(),
}: StatefulHistoryOptions = {}) {
  useHistoryScreenStateMock.mockImplementation(() => {
    const [selectedRunId, setSelectedRunId] = useState<string | null>("run-1");
    const [selectedDateId, setSelectedDateId] = useState("all");

    return makeHistoryScreenState({
      timelineItems: [
        { id: "all", label: "All", count: 2 },
        { id: "today", label: "Today", count: 2 },
      ],
      selectedDateId,
      setSelectedDateId: vi.fn(setSelectedDateId),
      mappedRuns: RUNS,
      selectedRunId,
      setSelectedRunId: vi.fn(setSelectedRunId),
      setSearchQuery: vi.fn(setSearchQuery),
      hasReviews: true,
      hasMoreReviews,
      loadMoreReviews,
    });
  });
}

beforeEach(() => {
  terminalSize.columns = 100;
  terminalSize.rows = 30;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HistoryScreen zone navigation", () => {
  test("crosses the pane edges with left and right arrows", async () => {
    mockStatefulHistory();
    const view = renderHistoryScreen();
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);

    view.stdin.write(RIGHT);
    await flush();
    expect(view.lastFrame()).toContain(INSIGHTS_FOOTER);

    view.stdin.write(RIGHT);
    await flush();
    expect(view.lastFrame()).toContain(INSIGHTS_FOOTER);

    view.stdin.write(LEFT);
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);

    view.stdin.write(LEFT);
    await flush();
    expect(view.lastFrame()).toContain(TIMELINE_FOOTER);

    view.stdin.write(LEFT);
    await flush();
    expect(view.lastFrame()).toContain(TIMELINE_FOOTER);

    view.stdin.write(RIGHT);
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);
  });

  test("enters search from the top of the runs list and leaves it downward", async () => {
    const setSearchQuery = vi.fn();
    mockStatefulHistory({ setSearchQuery });
    const view = renderHistoryScreen();
    await flush();

    view.stdin.write(DOWN);
    await flush();
    view.stdin.write(UP);
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);

    view.stdin.write(UP);
    await flush();
    expect(view.lastFrame()).toContain(SEARCH_FOOTER);

    view.stdin.write("x");
    await flush();
    expect(setSearchQuery).toHaveBeenCalledExactlyOnceWith("x");

    view.stdin.write(DOWN);
    await flush();
    expect(view.lastFrame()).toContain(TIMELINE_FOOTER);
  });

  test("enters search from the top of the timeline list", async () => {
    mockStatefulHistory();
    const view = renderHistoryScreen();
    await flush();

    view.stdin.write(LEFT);
    await flush();
    expect(view.lastFrame()).toContain(TIMELINE_FOOTER);

    view.stdin.write(DOWN);
    await flush();
    expect(view.lastFrame()).toContain(TIMELINE_FOOTER);

    view.stdin.write(UP);
    await flush();
    expect(view.lastFrame()).toContain(TIMELINE_FOOTER);

    view.stdin.write(UP);
    await flush();
    expect(view.lastFrame()).toContain(SEARCH_FOOTER);
  });

  test("stops on the load older runs row below the last run", async () => {
    const loadMoreReviews = vi.fn(async () => {});
    mockStatefulHistory({ hasMoreReviews: true, loadMoreReviews });
    const view = renderHistoryScreen();
    await flush();
    expect(view.lastFrame()).toContain("Load older runs");

    view.stdin.write(DOWN);
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);

    view.stdin.write(DOWN);
    await flush();
    expect(view.lastFrame()).toContain(LOAD_MORE_FOOTER);

    view.stdin.write("\r");
    await flush();
    expect(loadMoreReviews).toHaveBeenCalledOnce();

    view.stdin.write(UP);
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);

    view.stdin.write("l");
    await flush();
    expect(loadMoreReviews).toHaveBeenCalledTimes(2);
  });

  test("leaves the load older runs row when a pane edge is crossed", async () => {
    mockStatefulHistory({ hasMoreReviews: true });
    const view = renderHistoryScreen();
    await flush();

    view.stdin.write(DOWN);
    await flush();
    view.stdin.write(DOWN);
    await flush();
    expect(view.lastFrame()).toContain(LOAD_MORE_FOOTER);

    view.stdin.write(RIGHT);
    await flush();
    expect(view.lastFrame()).toContain(INSIGHTS_FOOTER);

    view.stdin.write(LEFT);
    await flush();
    expect(view.lastFrame()).toContain(RUNS_FOOTER);
  });
});
