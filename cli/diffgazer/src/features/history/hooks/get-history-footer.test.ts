import { test, describe, expect } from "vitest";
import { getHistoryFooter } from "./get-history-footer.js";

describe("getHistoryFooter", () => {
  test("search zone shows clear-search on the right and only the timeline shortcut", () => {
    const footer = getHistoryFooter("search");
    expect(footer.shortcuts).toEqual([{ key: "↓", label: "Timeline" }]);
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Clear Search" }]);
  });

  test("timeline zone shows date-selection shortcut and Back", () => {
    const footer = getHistoryFooter("timeline");
    expect(
      footer.shortcuts.some((s) => s.label === "Select Date"),
      "missing Select Date shortcut",
    ).toBeTruthy();
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  test("runs zone exposes Open Review and the o shortcut", () => {
    const footer = getHistoryFooter("runs");
    const labels = footer.shortcuts.map((s) => s.label);
    expect(labels.includes("Open Review")).toBeTruthy();
    expect(footer.shortcuts.some((s) => s.key === "o")).toBeTruthy();
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  test("insights zone exposes Open Review", () => {
    const footer = getHistoryFooter("insights");
    expect(footer.shortcuts.some((s) => s.label === "Open Review")).toBeTruthy();
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
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

  test("non-search zones always end with a single Back shortcut on the right", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
    }
  });
});
