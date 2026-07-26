import { describe, expect, test } from "vitest";
import { computePaneGeometry } from "./pane-geometry";

const WIDE = {
  columns: 120,
  contentRows: 26,
  isNarrow: false,
  hasDuplicateNotice: false,
};

describe("computePaneGeometry", () => {
  test("gives both wide panes the full frame height beside a proportional list column", () => {
    const geometry = computePaneGeometry(WIDE);

    expect(geometry.listWidth).toBe(48);
    expect(geometry.listContentWidth).toBe(44);
    expect(geometry.listPaneHeight).toBe(24);
    expect(geometry.detailsPaneHeight).toBe(24);
    expect(geometry.listScrollHeight).toBe(17);
    expect(geometry.detailScrollHeight).toBe(15);
    expect(geometry.showDetailsTabs).toBe(true);
  });

  test("gives the list the same share of every frame, never less as it grows", () => {
    expect(computePaneGeometry({ ...WIDE, columns: 100 }).listWidth).toBe(40);
    expect(computePaneGeometry({ ...WIDE, columns: 80 }).listWidth).toBe(34);
    expect(computePaneGeometry({ ...WIDE, columns: 200 }).listWidth).toBe(56);

    const widths = [80, 100, 120, 200].map(
      (columns) => computePaneGeometry({ ...WIDE, columns }).listWidth,
    );
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });

  test("reserves a row for the duplicate notice", () => {
    const withNotice = computePaneGeometry({ ...WIDE, hasDuplicateNotice: true });
    expect(withNotice.listPaneHeight).toBe(WIDE.contentRows - 3);
  });

  test("splits a narrow frame between the panes without losing a row to rounding", () => {
    const geometry = computePaneGeometry({ ...WIDE, isNarrow: true, contentRows: 25 });

    expect(geometry.listPaneHeight + geometry.detailsPaneHeight).toBe(23);
    expect(geometry.listPaneHeight).toBe(12);
    expect(geometry.detailsPaneHeight).toBe(11);
    expect(geometry.listContentWidth).toBe(WIDE.columns - 4);
  });

  test("drops the narrow details tab row once the half-pane cannot spare a body row", () => {
    const roomy = computePaneGeometry({ ...WIDE, isNarrow: true, contentRows: 26 });
    expect(roomy.showDetailsTabs).toBe(true);

    const cramped = computePaneGeometry({ ...WIDE, isNarrow: true, contentRows: 16 });
    expect(cramped.showDetailsTabs).toBe(false);
    expect(cramped.detailScrollHeight).toBeGreaterThanOrEqual(1);
  });

  test("keeps every derived height at one row or more in a collapsed frame", () => {
    const collapsed = computePaneGeometry({
      ...WIDE,
      contentRows: 1,
      isNarrow: true,
      hasDuplicateNotice: true,
    });

    expect(collapsed.listPaneHeight).toBeGreaterThanOrEqual(1);
    expect(collapsed.listScrollHeight).toBe(1);
    expect(collapsed.detailScrollHeight).toBe(1);
  });
});
