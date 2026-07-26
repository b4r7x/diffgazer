import { describe, expect, test } from "vitest";
import { computePaneLayout, getVisibleHistoryPanes } from "./pane-layout";

const WIDE = { columns: 120, isNarrow: false, contentRows: 30, warningCount: 0 };

describe("computePaneLayout", () => {
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
