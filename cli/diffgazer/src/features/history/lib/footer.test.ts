import { describe, expect, test } from "vitest";
import { getHistoryFooter } from "./footer";

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
});
