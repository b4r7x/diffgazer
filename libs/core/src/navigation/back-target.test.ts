import { describe, expect, it } from "vitest";
import { getBackTarget } from "./back-target";

describe("getBackTarget", () => {
  it("returns the settings root for a settings sub-route", () => {
    expect(getBackTarget("/settings/theme")).toBe("/settings");
    expect(getBackTarget("/settings/providers/openrouter")).toBe("/settings");
  });

  it("returns the home path when leaving the settings root", () => {
    expect(getBackTarget("/settings")).toBe("/");
  });

  it("accepts a path without a leading slash", () => {
    expect(getBackTarget("settings/theme")).toBe("/settings");
    expect(getBackTarget("settings")).toBe("/");
  });

  it("strips a trailing slash before matching", () => {
    expect(getBackTarget("/settings/theme/")).toBe("/settings");
    expect(getBackTarget("/settings/")).toBe("/");
  });

  it("returns null for paths that have no implicit back target", () => {
    expect(getBackTarget("/")).toBeNull();
    expect(getBackTarget("/history")).toBeNull();
    expect(getBackTarget("/review/abc")).toBeNull();
  });
});
