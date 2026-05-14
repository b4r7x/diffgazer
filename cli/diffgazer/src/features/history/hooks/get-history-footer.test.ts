import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getHistoryFooter } from "./get-history-footer.js";

describe("getHistoryFooter", () => {
  test("search zone shows clear-search on the right and only the timeline shortcut", () => {
    const footer = getHistoryFooter("search");
    assert.deepEqual(footer.shortcuts, [{ key: "↓", label: "Timeline" }]);
    assert.deepEqual(footer.rightShortcuts, [{ key: "Esc", label: "Clear Search" }]);
  });

  test("timeline zone shows date-selection shortcut and Back", () => {
    const footer = getHistoryFooter("timeline");
    assert.ok(
      footer.shortcuts.some((s) => s.label === "Select Date"),
      "missing Select Date shortcut",
    );
    assert.deepEqual(footer.rightShortcuts, [{ key: "Esc", label: "Back" }]);
  });

  test("runs zone exposes Open Review and the o shortcut", () => {
    const footer = getHistoryFooter("runs");
    const labels = footer.shortcuts.map((s) => s.label);
    assert.ok(labels.includes("Open Review"));
    assert.ok(footer.shortcuts.some((s) => s.key === "o"));
    assert.deepEqual(footer.rightShortcuts, [{ key: "Esc", label: "Back" }]);
  });

  test("insights zone exposes Open Review", () => {
    const footer = getHistoryFooter("insights");
    assert.ok(footer.shortcuts.some((s) => s.label === "Open Review"));
    assert.deepEqual(footer.rightShortcuts, [{ key: "Esc", label: "Back" }]);
  });

  test("every zone exposes / search except search itself", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      assert.ok(
        footer.shortcuts.some((s) => s.key === "/"),
        `${zone} missing slash shortcut`,
      );
    }
    const searchFooter = getHistoryFooter("search");
    assert.ok(!searchFooter.shortcuts.some((s) => s.key === "/"));
  });

  test("non-search zones all include Tab switch focus", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      assert.ok(
        footer.shortcuts.some((s) => s.key === "Tab"),
        `${zone} missing Tab shortcut`,
      );
    }
  });

  test("search zone never exposes Tab (no zone switching while typing)", () => {
    const footer = getHistoryFooter("search");
    assert.ok(!footer.shortcuts.some((s) => s.key === "Tab"));
  });

  test("non-search zones always end with a single Back shortcut on the right", () => {
    for (const zone of ["timeline", "runs", "insights"] as const) {
      const footer = getHistoryFooter(zone);
      assert.deepEqual(footer.rightShortcuts, [{ key: "Esc", label: "Back" }]);
    }
  });
});
