import { describe, expect, it } from "vitest";
import {
  BACK_SHORTCUT,
  BACK_SHORTCUTS,
  HELP_SHORTCUTS,
  MAIN_MENU_SHORTCUTS,
  NAVIGATE_SHORTCUT,
  TRUST_FOOTER_RIGHT_SHORTCUTS,
  TRUST_FOOTER_SHORTCUTS,
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
  it("omits the nonexistent r/R review bindings", () => {
    const keys = HELP_SHORTCUTS.map((shortcut) => shortcut.key);
    expect(keys).not.toContain("r");
    expect(keys).not.toContain("R");
  });

  it("advertises the live Open Help binding", () => {
    expect(HELP_SHORTCUTS).toContainEqual({ key: "?", label: "Open Help" });
  });

  it("describes j/k as navigation and lists the scroll controls separately", () => {
    expect(HELP_SHORTCUTS).toContainEqual({
      key: "j/k",
      label: "Navigate Lists and Fix Plan",
    });
    expect(HELP_SHORTCUTS).toEqual(
      expect.arrayContaining([
        { key: "↑/↓", label: "Scroll Content" },
        { key: "PgUp/PgDn", label: "Scroll Content" },
        { key: "Home/End", label: "Scroll Content" },
      ]),
    );
  });
});

describe("trust footer shortcut constants", () => {
  it("advertises the live Help binding, not the dead 'h'", () => {
    const keys = TRUST_FOOTER_RIGHT_SHORTCUTS.map((shortcut) => shortcut.key);
    expect(keys).toContain("?");
    expect(keys).not.toContain("h");
  });

  it("declares the permission controls and action-focus transition", () => {
    expect(TRUST_FOOTER_SHORTCUTS).toEqual([
      { key: "↑/↓", label: "Navigate Permissions" },
      { key: "Enter/Space", label: "Toggle" },
      { key: "Tab", label: "Focus Actions" },
      { key: "q", label: "Quit" },
    ]);
  });
});
