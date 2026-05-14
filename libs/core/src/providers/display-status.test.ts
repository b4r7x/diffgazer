import { describe, expect, it } from "vitest";
import {
  getDisplayStatusBadge,
  getProviderDisplay,
  getProviderDisplayStatus,
} from "./display-status.js";

describe("getDisplayStatusBadge", () => {
  it("maps each display status to its badge label and variant", () => {
    expect(getDisplayStatusBadge("active")).toEqual({ label: "active", variant: "success" });
    expect(getDisplayStatusBadge("configured")).toEqual({ label: "configured", variant: "info" });
    expect(getDisplayStatusBadge("needs-key")).toEqual({
      label: "needs key",
      variant: "neutral",
    });
  });
});

describe("getProviderDisplayStatus", () => {
  it("is idle while loading regardless of configuration", () => {
    expect(getProviderDisplayStatus(true, false)).toBe("idle");
    expect(getProviderDisplayStatus(true, true)).toBe("idle");
  });

  it("is active when not loading and configured", () => {
    expect(getProviderDisplayStatus(false, true)).toBe("active");
  });

  it("is idle when not loading and not configured", () => {
    expect(getProviderDisplayStatus(false, false)).toBe("idle");
  });
});

describe("getProviderDisplay", () => {
  it("returns the not-configured placeholder when provider is missing", () => {
    expect(getProviderDisplay()).toBe("Not configured");
    expect(getProviderDisplay(undefined, "gpt-4")).toBe("Not configured");
  });

  it("joins provider and model with a slash when both are set", () => {
    expect(getProviderDisplay("gemini", "gemini-2.5-flash")).toBe(
      "gemini / gemini-2.5-flash",
    );
  });

  it("returns the provider name when no model is set", () => {
    expect(getProviderDisplay("gemini")).toBe("gemini");
  });
});
