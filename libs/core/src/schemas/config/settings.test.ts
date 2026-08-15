import { describe, expect, it } from "vitest";
import {
  applySettingsPatch,
  DEFAULT_SETTINGS,
  parseSettingsRecord,
  SettingsConfigSchema,
  serializeSettingsRecord,
} from "./settings.js";

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

describe("parseSettingsRecord", () => {
  it("preserves malformed known values opaquely with diagnostics", () => {
    const parsed = parseSettingsRecord({
      ...DEFAULT_SETTINGS,
      theme: "holographic",
    });

    expect(parsed.settings.theme).toBe("auto");
    expect(parsed.unknown.theme).toBe("holographic");
    expect(parsed.diagnostics).toEqual([{ field: "theme", code: "invalid-value" }]);
  });

  it("keeps unrelated persisted keys and falls back to defaults for absent known fields", () => {
    const parsed = parseSettingsRecord({ theme: "dark", experimentalFlag: { nested: true } });

    expect(parsed.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
    expect(parsed.unknown).toEqual({ experimentalFlag: { nested: true } });
    expect(parsed.diagnostics).toEqual([]);
    expect(serializeSettingsRecord(parsed)).toMatchObject({
      theme: "dark",
      experimentalFlag: { nested: true },
    });
  });

  it("preserves future enum values without overwriting them on unrelated patches", () => {
    const raw = {
      ...DEFAULT_SETTINGS,
      agentExecution: "turbo",
    };
    const parsed = parseSettingsRecord(raw);

    expect(parsed.settings.agentExecution).toBe("sequential");
    expect(parsed.unknown.agentExecution).toBe("turbo");

    const patched = applySettingsPatch(raw, { theme: "dark" });
    expect(patched.theme).toBe("dark");
    expect(patched.agentExecution).toBe("turbo");
    expect(serializeSettingsRecord(parseSettingsRecord(patched)).agentExecution).toBe("turbo");
  });

  it("clears salvaged bytes once a known field is repaired explicitly", () => {
    const raw = {
      ...DEFAULT_SETTINGS,
      theme: "holographic",
    };
    const repaired = applySettingsPatch(raw, { theme: "dark" });

    expect(repaired.theme).toBe("dark");
    expect(parseSettingsRecord(repaired).unknown).not.toHaveProperty("theme");
    expect(parseSettingsRecord(repaired).diagnostics).toEqual([]);
  });
});
