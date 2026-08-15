import { describe, expect, test } from "vitest";
import {
  computePaneLayout,
  getHistoryCalloutRows,
  getHistoryWarningBlockRows,
  getHistoryWarningBudget,
  getVisibleHistoryPanes,
} from "./pane-layout";

const WIDE = { columns: 120, isNarrow: false, contentRows: 30, warningCount: 0 };

describe("computePaneLayout", () => {
  test("keeps the callout box height separate from its following gap", () => {
    const calloutRows = getHistoryCalloutRows(["warning"], 80);
    expect(getHistoryWarningBlockRows(["warning"], 80)).toBe(calloutRows + 1);
  });

  test("splits a wide frame into three side-by-side panes that fit the content width", () => {
    const layout = computePaneLayout(WIDE);

    expect(layout.sectionsWidth).toBe(16);
    expect(layout.insightsWidth).toBe(50);
    expect(layout.sectionsPaneWidth).toBe(layout.sectionsWidth);
    expect(layout.sectionsWidth + layout.insightsWidth + layout.runsPaneWidth).toBe(120);
    expect(layout.runsPaneWidth).toBeGreaterThanOrEqual(44);
    expect(layout.canStackPanes).toBe(true);
    expect(layout.paneSlotHeight).toBe(layout.paneHeight);
  });

  test("holds every pane to a minimum width on a narrow frame", () => {
    const layout = computePaneLayout({ ...WIDE, columns: 60 });

    expect(layout.sectionsWidth).toBe(14);
    expect(layout.insightsWidth).toBe(26);
    expect(layout.runsPaneWidth).toBeGreaterThanOrEqual(1);
  });

  test("never gives a wider frame less room than a narrower one", () => {
    const widths = [80, 100, 120, 160].map((columns) => computePaneLayout({ ...WIDE, columns }));

    for (let index = 1; index < widths.length; index += 1) {
      const previous = widths[index - 1];
      const current = widths[index];
      if (previous === undefined || current === undefined) throw new Error("missing layout");
      expect(current.insightsWidth).toBeGreaterThanOrEqual(previous.insightsWidth);
      expect(current.runsPaneWidth).toBeGreaterThanOrEqual(previous.runsPaneWidth);
    }
  });

  test("gives each stacked pane a third of the height when the narrow stack fits", () => {
    const layout = computePaneLayout({ ...WIDE, isNarrow: true, contentRows: 40 });

    expect(layout.paneHeight).toBe(33);
    expect(layout.canStackPanes).toBe(true);
    expect(layout.paneSlotHeight).toBe(11);
    expect(layout.listHeight).toBe(7);
    expect(layout.insightScrollHeight).toBe(6);
  });

  test("gives the shallowest stacking frame a slot that still holds the insights chrome", () => {
    const layout = computePaneLayout({ ...WIDE, isNarrow: true, contentRows: 25 });

    expect(layout.paneHeight).toBe(18);
    expect(layout.canStackPanes).toBe(true);
    expect(layout.paneSlotHeight).toBe(6);
    expect(layout.insightScrollHeight).toBe(1);
  });

  test("stops stacking when a third of the height cannot hold the insights chrome", () => {
    const layout = computePaneLayout({ ...WIDE, isNarrow: true, contentRows: 22 });

    expect(layout.paneHeight).toBe(15);
    expect(layout.canStackPanes).toBe(false);
    expect(layout.paneSlotHeight).toBe(layout.paneHeight);
  });

  test("reserves rows for the warning callout and never returns a zero-height pane", () => {
    const withWarnings = computePaneLayout({ ...WIDE, warningCount: 2 });
    expect(withWarnings.paneHeight).toBe(30 - 7 - 6);

    const squeezed = computePaneLayout({ ...WIDE, contentRows: 4, warningCount: 3 });
    expect(squeezed.paneHeight).toBe(1);
    expect(squeezed.listHeight).toBe(1);
    expect(squeezed.insightScrollHeight).toBe(1);
  });

  test.each([
    [20, "20 saved reviews (#00000000, #00000001, #00000002, … +17 more) could not be read."],
    [50, "50 saved reviews (#00000000, #00000001, #00000002, … +47 more) could not be read."],
  ])("reserves every wrapped row for bounded unreadable warnings (%d)", (_count, message) => {
    const warningRows = getHistoryWarningBlockRows([message], 80);
    const layout = computePaneLayout({
      ...WIDE,
      warningCount: 1,
      warningRows,
    });

    expect(warningRows).toBeGreaterThan(5);
    expect(layout.paneHeight).toBe(30 - 7 - warningRows);
  });

  test("sums wrapped rows for mixed warning messages and bounded details", () => {
    const messages = [
      "20 saved reviews (#00000000, #00000001, #00000002, … +17 more) could not be read.",
      "20 invalid saved issues were omitted from #00000000, #00000001, #00000002, … +17 more. Re-run the affected reviews for complete results.",
    ];
    const warningRows = getHistoryWarningBlockRows(messages, 80);
    const layout = computePaneLayout({
      ...WIDE,
      warningCount: messages.length,
      warningRows,
    });

    expect(warningRows).toBeGreaterThan(messages.length + 4);
    expect(layout.paneHeight).toBe(30 - 7 - warningRows);
  });

  test("budgets two compact salvaged-run rows when warning copy squeezes the panes", () => {
    const warningBudget = getHistoryWarningBudget(20, 2);
    const layout = computePaneLayout({
      ...WIDE,
      contentRows: 20,
      warningCount: 3,
      warningRows: warningBudget,
    });

    expect(layout.paneHeight).toBe(6);
    expect(layout.listHeight).toBe(2);
  });
});

describe("getVisibleHistoryPanes", () => {
  test("shows all three panes whenever the stack fits", () => {
    expect(getVisibleHistoryPanes("insights", true)).toEqual({
      sections: true,
      runs: true,
      insights: true,
    });
  });

  test("shows only the focused pane when the stack does not fit", () => {
    expect(getVisibleHistoryPanes("timeline", false)).toEqual({
      sections: true,
      runs: false,
      insights: false,
    });
    expect(getVisibleHistoryPanes("insights", false)).toEqual({
      sections: false,
      runs: false,
      insights: true,
    });
  });

  test("falls back to the runs pane for the search zone", () => {
    expect(getVisibleHistoryPanes("search", false)).toEqual({
      sections: false,
      runs: true,
      insights: false,
    });
    expect(getVisibleHistoryPanes("runs", false)).toEqual({
      sections: false,
      runs: true,
      insights: false,
    });
  });
});
