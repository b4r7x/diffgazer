import { describe, expect, it } from "vitest";
import { MENU_ITEMS } from "./navigation.js";
import {
  areShortcutsEqual,
  BACK_SHORTCUT,
  BACK_SHORTCUTS,
  groupShortcutsByContext,
  HELP_SHORTCUTS,
  MAIN_MENU_SHORTCUTS,
  NAVIGATE_SHORTCUT,
  SHORTCUT_CONTEXT_LABELS,
  TRUST_PERMISSION_SHORTCUTS,
} from "./shortcuts.js";

describe("MAIN_MENU_SHORTCUTS", () => {
  it("uses the canonical Navigate/Select/Quit wording", () => {
    expect(MAIN_MENU_SHORTCUTS).toEqual([
      { key: "↑/↓", label: "Navigate" },
      { key: "Enter", label: "Select" },
      { key: "q", label: "Quit" },
    ]);
  });
});

describe("footer shortcut constants", () => {
  it("declares the canonical Back/Navigate fragments", () => {
    expect(BACK_SHORTCUT).toEqual({ key: "Esc", label: "Back" });
    expect(NAVIGATE_SHORTCUT).toEqual({ key: "↑/↓", label: "Navigate" });
    expect(BACK_SHORTCUTS).toEqual([BACK_SHORTCUT]);
  });
});

describe("HELP_SHORTCUTS", () => {
  it("documents every home review binding the shared menu advertises", () => {
    expect(HELP_SHORTCUTS.filter((shortcut) => shortcut.context === "home")).toEqual(
      MENU_ITEMS.filter((item) => item.group === "review").map((item) => ({
        key: item.shortcut,
        label: item.label,
        context: "home",
      })),
    );
  });

  it("advertises the live Open Help binding", () => {
    expect(HELP_SHORTCUTS).toContainEqual({ key: "?", label: "Open Help", context: "global" });
  });

  it("advertises the live history search binding", () => {
    expect(HELP_SHORTCUTS).toContainEqual({
      key: "/",
      label: "Search Runs",
      context: "history",
    });
  });

  it("gives ↑/↓ and j/k one shared label so the two list rows collapse", () => {
    const listShortcuts = HELP_SHORTCUTS.filter((shortcut) => shortcut.context === "list");
    expect(listShortcuts.map((shortcut) => shortcut.key)).toEqual(["↑/↓", "j/k"]);
    expect(new Set(listShortcuts.map((shortcut) => shortcut.label))).toEqual(
      new Set(["Move the highlight"]),
    );
  });

  it("carries the review context in the group instead of the label", () => {
    const switchTab = HELP_SHORTCUTS.find((shortcut) => shortcut.key === "1-4");
    expect(switchTab).toEqual({ key: "1-4", label: "Switch Tab", context: "review" });
    // Each scroll key says what it does: grouping alone would leave three
    // identical labels stacked on a surface without a label collapser.
    const scrollRows = HELP_SHORTCUTS.filter((shortcut) =>
      ["↑/↓", "PgUp/PgDn", "Home/End"].includes(shortcut.key),
    ).filter((shortcut) => shortcut.context === "review");
    expect(scrollRows.map((shortcut) => shortcut.label)).toEqual([
      "Scroll the focused pane",
      "Page up or down",
      "Jump to start or end",
    ]);
  });

  it("tags every entry so nothing silently falls back to Anywhere", () => {
    expect(HELP_SHORTCUTS.every((shortcut) => shortcut.context !== undefined)).toBe(true);
  });
});

describe("groupShortcutsByContext", () => {
  it("returns the canonical order and omits empty groups", () => {
    const groups = groupShortcutsByContext([
      { key: "/", label: "Search Runs", context: "history" },
      { key: "Enter", label: "Select", context: "global" },
      { key: "j/k", label: "Move the highlight", context: "list" },
    ]);
    expect(groups.map((group) => group.context)).toEqual(["global", "list", "history"]);
  });

  it("defaults untagged entries to global and preserves within-group order", () => {
    const groups = groupShortcutsByContext([
      { key: "a", label: "First" },
      { key: "b", label: "Second", context: "global" },
    ]);
    expect(groups).toEqual([
      {
        context: "global",
        shortcuts: [
          { key: "a", label: "First" },
          { key: "b", label: "Second", context: "global" },
        ],
      },
    ]);
  });

  it("labels every context it can produce", () => {
    for (const group of groupShortcutsByContext(HELP_SHORTCUTS)) {
      expect(SHORTCUT_CONTEXT_LABELS[group.context]).toBeTruthy();
    }
  });
});

describe("areShortcutsEqual", () => {
  it("distinguishes shortcuts that differ only by context", () => {
    expect(
      areShortcutsEqual(
        [{ key: "↑/↓", label: "Move the highlight", context: "list" }],
        [{ key: "↑/↓", label: "Move the highlight", context: "review" }],
      ),
    ).toBe(false);
    expect(
      areShortcutsEqual(
        [{ key: "↑/↓", label: "Move the highlight", context: "list" }],
        [{ key: "↑/↓", label: "Move the highlight", context: "list" }],
      ),
    ).toBe(true);
  });
});

describe("TRUST_PERMISSION_SHORTCUTS", () => {
  it("carries only the permission controls both surfaces share", () => {
    expect(TRUST_PERMISSION_SHORTCUTS).toEqual([
      { key: "↑/↓", label: "Navigate Permissions" },
      { key: "Enter/Space", label: "Toggle" },
    ]);
  });
});
