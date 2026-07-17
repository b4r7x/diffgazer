import { describe, expect, it } from "vitest";
import { SettingsConfigSchema } from "./settings.js";

const baseSettings = {
  theme: "auto" as const,
  defaultProfile: null,
  severityThreshold: "low" as const,
  secretsStorage: null,
  agentExecution: "sequential" as const,
};

describe("SettingsConfigSchema", () => {
  it("normalizes duplicate default lenses in first-seen order", () => {
    const settings = SettingsConfigSchema.parse({
      ...baseSettings,
      defaultLenses: ["security", "correctness", "security", "tests", "correctness"],
    });

    expect(settings.defaultLenses).toEqual(["security", "correctness", "tests"]);
  });

  it("canonicalizes duplicate-heavy input before applying the finite lens set", () => {
    const settings = SettingsConfigSchema.parse({
      ...baseSettings,
      defaultLenses: Array.from({ length: 20 }, () => "correctness"),
    });

    expect(settings.defaultLenses).toEqual(["correctness"]);
  });

  it("rejects an empty default lens list", () => {
    const result = SettingsConfigSchema.safeParse({
      ...baseSettings,
      defaultLenses: [],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "too_small",
        minimum: 1,
        path: ["defaultLenses"],
      }),
    );
  });
});
