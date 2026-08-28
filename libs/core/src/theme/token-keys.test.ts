import { describe, expect, it } from "vitest";
import { THEME_TOKEN_KEYS } from "./token-keys.js";

describe("THEME_TOKEN_KEYS", () => {
  it("exposes the agreed cross-app token vocabulary, with no duplicates", () => {
    expect(THEME_TOKEN_KEYS).toEqual([
      "bg",
      "fg",
      "blue",
      "violet",
      "green",
      "red",
      "yellow",
      "border",
      "muted",
      "success",
      "warning",
      "error",
      "info",
      "accent",
      "severityBlocker",
      "severityHigh",
      "severityMedium",
      "severityLow",
      "severityNit",
      "statusRunning",
      "statusComplete",
      "statusPending",
    ]);
    expect(new Set(THEME_TOKEN_KEYS).size).toBe(THEME_TOKEN_KEYS.length);
  });
});
