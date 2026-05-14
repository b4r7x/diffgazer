import { describe, expect, it } from "vitest";
import { getBackTarget, resolveBackAction } from "./back-navigation";

describe("getBackTarget", () => {
  it("returns settings hub for settings subpages", () => {
    expect(getBackTarget("/settings/theme")).toBe("/settings");
    expect(getBackTarget("/settings/providers")).toBe("/settings");
  });

  it("returns main menu for settings root", () => {
    expect(getBackTarget("/settings")).toBe("/");
    expect(getBackTarget("/settings/")).toBe("/");
  });

  it("returns null outside settings routes", () => {
    expect(getBackTarget("/")).toBeNull();
    expect(getBackTarget("/history")).toBeNull();
    expect(getBackTarget("/settings-legacy")).toBeNull();
  });
});

describe("resolveBackAction", () => {
  it("uses deterministic route mapping in settings flow", () => {
    expect(resolveBackAction("/settings/theme", true)).toEqual({
      type: "navigate",
      to: "/settings",
    });
    expect(resolveBackAction("/settings", false)).toEqual({
      type: "navigate",
      to: "/",
    });
  });

  it("falls back to home when there is no browser history target", () => {
    expect(resolveBackAction("/history", false)).toEqual({
      type: "navigate",
      to: "/",
    });
  });

  it("keeps history-back behavior outside settings when history exists", () => {
    expect(resolveBackAction("/history", true)).toEqual({ type: "history" });
  });

  it("hides back action on home route", () => {
    expect(resolveBackAction("/", true)).toEqual({ type: "none" });
  });
});
