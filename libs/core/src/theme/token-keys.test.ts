import { describe, expect, it } from "vitest";
import {
  PRIMITIVE_TOKEN_KEYS,
  SEMANTIC_TOKEN_KEYS,
  SEVERITY_TOKEN_KEYS,
  STATUS_TOKEN_KEYS,
  THEME_TOKEN_KEYS,
} from "./token-keys.js";

describe("THEME_TOKEN_KEYS", () => {
  it("aggregates every group with no duplicates", () => {
    const union = [
      ...PRIMITIVE_TOKEN_KEYS,
      ...SEMANTIC_TOKEN_KEYS,
      ...SEVERITY_TOKEN_KEYS,
      ...STATUS_TOKEN_KEYS,
    ];
    expect([...THEME_TOKEN_KEYS]).toEqual(union);
    expect(new Set(THEME_TOKEN_KEYS).size).toBe(THEME_TOKEN_KEYS.length);
  });

  it("exposes the agreed cross-app token vocabulary", () => {
    expect([...THEME_TOKEN_KEYS]).toEqual([
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
  });
});
