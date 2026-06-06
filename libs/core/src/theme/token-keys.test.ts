import { describe, expect, it } from "vitest";
import type { ThemeTokenKey } from "./token-keys.js";
import {
  PRIMITIVE_TOKEN_KEYS,
  SEMANTIC_TOKEN_KEYS,
  SEVERITY_TOKEN_KEYS,
  STATUS_TOKEN_KEYS,
  THEME_TOKEN_KEYS,
} from "./token-keys.js";
import type { ThemeTokens } from "./types.js";

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

describe("ThemeTokens contract", () => {
  it("indexes every canonical key when a palette is built from THEME_TOKEN_KEYS", () => {
    const sample: ThemeTokens = Object.fromEntries(
      THEME_TOKEN_KEYS.map((key) => [key, "#000000"]),
    ) as ThemeTokens;
    for (const key of THEME_TOKEN_KEYS) {
      expect(sample[key]).toBe("#000000");
    }
  });

  it("ThemeTokenKey accepts each canonical vocabulary entry at compile time", () => {
    // Each assignment fails to compile if THEME_TOKEN_KEYS drifts from ThemeTokenKey.
    const primitive: ThemeTokenKey = "bg";
    const semantic: ThemeTokenKey = "success";
    const severity: ThemeTokenKey = "severityBlocker";
    const status: ThemeTokenKey = "statusRunning";

    expect([primitive, semantic, severity, status]).toEqual([
      "bg",
      "success",
      "severityBlocker",
      "statusRunning",
    ]);
  });
});
