import { describe, expect, it } from "vitest";
import {
  BACK_SHORTCUT,
  BACK_SHORTCUTS,
  HELP_SHORTCUTS,
  NAVIGATE_SHORTCUT,
  TRUST_FOOTER_RIGHT_SHORTCUTS,
  TRUST_FOOTER_SHORTCUTS,
} from "./shortcuts.js";

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
});

describe("trust footer shortcut constants", () => {
  it("advertises the live Help binding, not the dead 'h'", () => {
    const keys = TRUST_FOOTER_RIGHT_SHORTCUTS.map((shortcut) => shortcut.key);
    expect(keys).toContain("?");
    expect(keys).not.toContain("h");
  });

  it("declares the three byte-identical permission rows", () => {
    expect(TRUST_FOOTER_SHORTCUTS).toEqual([
      { key: "↑/↓", label: "Navigate Permissions" },
      { key: "Enter/Space", label: "Toggle Permission" },
      { key: "q", label: "Quit" },
    ]);
  });
});
