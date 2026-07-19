import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import { createElement, Fragment, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationContext } from "../../../hooks/use-navigation";
import { CliThemeProvider } from "../../../theme/provider";
import { HistoryScreen } from "../components/screen";
import { SectionsList } from "../components/sections-list";
import { getHistoryFooter } from "./footer";

const useHistoryScreenStateMock = vi.hoisted(() => vi.fn());
const usePageFooterMock = vi.hoisted(() => vi.fn());
const terminalSize = vi.hoisted(() => ({ columns: 100, rows: 30 }));
const SUPPORT_FLOOR = { columns: 80, rows: 24 } as const;

vi.mock("@diffgazer/core/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/review")>()),
  useHistoryScreenState: useHistoryScreenStateMock,
}));

vi.mock("@diffgazer/core/footer", () => ({
  usePageFooter: usePageFooterMock,
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useResponsive: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    isNarrow: terminalSize.columns < 80,
    isMedium: terminalSize.columns >= 80 && terminalSize.columns < 120,
  }),
  useTerminalDimensions: () => terminalSize,
}));

vi.mock("../../../components/layout/global", () => ({
  useContentZone: () => ({
    columns: terminalSize.columns,
    rows: terminalSize.rows,
    contentColumns: terminalSize.columns,
    contentRows: terminalSize.rows - 4,
  }),
}));

beforeEach(() => {
  terminalSize.columns = 100;
  terminalSize.rows = 30;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("getHistoryFooter", () => {
  test("search zone shows clear-search on the right and only the timeline shortcut", () => {
    const footer = getHistoryFooter("search");
    expect(footer.shortcuts).toEqual([{ key: "↓", label: "Timeline" }]);
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Clear Search" }]);
  });

  test("timeline zone describes selection-following arrow navigation and Back", () => {
    const footer = getHistoryFooter("timeline");
    expect(footer.shortcuts).toContainEqual({ key: "↑/↓", label: "Navigate" });
    expect(footer.shortcuts.some((shortcut) => shortcut.key === "Enter")).toBe(false);
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  test("timeline arrows immediately update the selected date", async () => {
    const items: TimelineItem[] = [
      { id: "all", label: "All", count: 4 },
      { id: "today", label: "Today", count: 2 },
    ];
    const onSelectedDateIdChange = vi.fn();

    function Harness() {
      const [selectedDateId, setSelectedDateId] = useState("all");
      return createElement(CliThemeProvider, {
        initialTheme: "dark",
        // biome-ignore lint/correctness/noChildrenProp: the .ts createElement overload requires this component's mandatory children in props.
        children: createElement(
          Fragment,
          null,
          createElement(Text, null, `Selected date: ${selectedDateId}`),
          createElement(SectionsList, {
            items,
            selectedId: selectedDateId,
            onSelect: vi.fn(),
            onHighlightChange: (id: string) => {
              setSelectedDateId(id);
              onSelectedDateIdChange(id);
            },
            height: 4,
            width: 18,
          }),
        ),
      });
    }

    const view = render(createElement(Harness));
    view.stdin.write("\u001B[B");
    await flush();

    expect(onSelectedDateIdChange).toHaveBeenCalledWith("today");
    expect(view.lastFrame()).toContain("Selected date: today");
  });

  test("runs zone exposes one Open Review shortcut", () => {
    const footer = getHistoryFooter("runs");
    expect(footer.shortcuts.filter((shortcut) => shortcut.label === "Open Review")).toEqual([
      { key: "Enter", label: "Open Review" },
    ]);
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  test("insights zone exposes Open Review", () => {
    const footer = getHistoryFooter("insights");
    expect(footer.shortcuts.some((s) => s.label === "Open Review")).toBeTruthy();
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  test("insights detail errors expose retry without replacing the pane shortcuts", () => {
    const footer = getHistoryFooter("insights", "error");

    expect(footer.shortcuts).toContainEqual({ key: "r", label: "Retry Details" });
    expect(footer.shortcuts).not.toContainEqual({ key: "Enter", label: "Open Review" });
    expect(footer.shortcuts).toContainEqual({ key: "Tab", label: "Switch Pane" });
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  test("ignores review-detail status outside Insights", () => {
    const modes = ["route", "search", "timeline", "runs"] satisfies Array<
      Parameters<typeof getHistoryFooter>[0]
    >;
    const statuses = ["loading", "error", "ready"] satisfies Array<
      NonNullable<Parameters<typeof getHistoryFooter>[1]>
    >;

    for (const mode of modes) {
      const expected = getHistoryFooter(mode);
      for (const status of statuses) {
        expect(getHistoryFooter(mode, status)).toEqual(expected);
      }
    }
  });

  test.each([
    ["loading", false, false],
    ["error", false, true],
    ["ready", true, false],
  ] satisfies Array<
    [NonNullable<Parameters<typeof getHistoryFooter>[1]>, boolean, boolean]
  >)("maps %s review details to truthful Insights shortcuts", (status, canOpen, canRetry) => {
    const footer = getHistoryFooter("insights", status);

    expect(footer.shortcuts.some((shortcut) => shortcut.key === "Enter")).toBe(canOpen);
    expect(footer.shortcuts.some((shortcut) => shortcut.key === "r")).toBe(canRetry);
  });

  test("every zone exposes / search except search itself", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      expect(
        footer.shortcuts.some((s) => s.key === "/"),
        `${zone} missing slash shortcut`,
      ).toBeTruthy();
    }
    const searchFooter = getHistoryFooter("search");
    expect(!searchFooter.shortcuts.some((s) => s.key === "/")).toBeTruthy();
  });

  test("non-search zones all include Tab switch focus", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      expect(
        footer.shortcuts.some((s) => s.key === "Tab"),
        `${zone} missing Tab shortcut`,
      ).toBeTruthy();
    }
  });

  test("search zone never exposes Tab (no zone switching while typing)", () => {
    const footer = getHistoryFooter("search");
    expect(!footer.shortcuts.some((s) => s.key === "Tab")).toBeTruthy();
  });

  test("keeps Tab in Search and the footer visible at the 80x24 support floor", async () => {
    Object.assign(terminalSize, SUPPORT_FLOOR);
    const setSearchQuery = vi.fn();
    const setSelectedDateId = vi.fn();
    useHistoryScreenStateMock.mockReturnValue({
      reviewsQuery: { data: { reviews: [] }, isLoading: false, error: null },
      reviewDetailQuery: {
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      },
      reviews: [],
      timelineItems: [
        { id: "all", label: "All", count: 1 },
        { id: "today", label: "Today", count: 1 },
      ],
      selectedDateId: "all",
      setSelectedDateId,
      searchQuery: "",
      setSearchQuery,
      mappedRuns: [
        {
          id: "history-review-1",
          displayId: "#hist",
          branch: "main",
          timestamp: "now",
          summary: "First run",
        },
      ],
      selectedRunId: "history-review-1",
      setSelectedRunId: vi.fn(),
      selectedRun: null,
      severityCounts: null,
      sortedIssues: [],
      duration: "",
      hasReviews: true,
      hasSearchQuery: false,
      emptyRunsMessage: "No runs yet",
      hasMoreReviews: false,
      isLoadingMoreReviews: false,
      loadMoreReviews: vi.fn(),
    });
    const view = render(
      createElement(
        CliThemeProvider,
        { initialTheme: "dark" } as Parameters<typeof CliThemeProvider>[0],
        createElement(
          NavigationContext.Provider,
          {
            value: {
              route: { screen: "history" },
              navigate: vi.fn(),
              goBack: vi.fn(),
              canGoBack: true,
            },
          },
          createElement(HistoryScreen),
        ),
      ),
    );
    expect(view.lastFrame()).toContain("RUNS");
    expect((view.lastFrame() ?? "").split("\n").length).toBeLessThanOrEqual(SUPPORT_FLOOR.rows);

    view.stdin.write("/");
    await flush();
    expect(usePageFooterMock).toHaveBeenLastCalledWith({
      shortcuts: [{ key: "↓", label: "Timeline" }],
      rightShortcuts: [{ key: "Esc", label: "Clear Search" }],
    });
    view.stdin.write("\t");
    await flush();
    view.stdin.write("x");
    await flush();

    expect(setSearchQuery).toHaveBeenCalledExactlyOnceWith("x");

    view.stdin.write("\u001B[B");
    await flush();
    view.stdin.write("\u001B[B");
    await flush();
    view.stdin.write("y");
    await flush();

    expect(setSelectedDateId).toHaveBeenCalledExactlyOnceWith("today");
    expect(setSearchQuery).toHaveBeenCalledExactlyOnceWith("x");
  });

  test("non-search zones always end with a single Back shortcut on the right", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
    }
  });
});

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
