import { describe, expect, it } from "vitest";
import {
  acceptProviderConsent,
  applySettingsPatch,
  DEFAULT_SETTINGS,
  EFFECTIVE_CALL_TOKEN_CAP,
  parseEffectiveCallTokenCap,
  parseSettingsRecord,
  REVIEW_WALL_TIME_CAP,
  SettingsConfigSchema,
  serializeSettingsRecord,
} from "./settings.js";

const baseSettings = {
  theme: "auto" as const,
  defaultProfile: null,
  severityThreshold: "low" as const,
  secretsStorage: null,
  agentExecution: "sequential" as const,
  providerConsent: null,
};

describe("SettingsConfigSchema", () => {
  it("normalizes duplicate default lenses in first-seen order", () => {
    const settings = SettingsConfigSchema.parse({
      ...baseSettings,
      defaultLenses: ["security", "correctness", "security", "tests", "correctness"],
    });

    expect(settings.defaultLenses).toEqual(["security", "correctness", "tests"]);
    expect(
      SettingsConfigSchema.parse({
        ...baseSettings,
        defaultLenses: Array.from({ length: 20 }, () => "correctness"),
      }).defaultLenses,
    ).toEqual(["correctness"]);
  });

  it("refuses the engine-only synthesis lens as a persisted default", () => {
    const result = SettingsConfigSchema.safeParse({
      ...baseSettings,
      defaultLenses: ["correctness", "synthesis"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a per-call token cap outside the supported range", () => {
    for (const effectiveCallTokenCap of [EFFECTIVE_CALL_TOKEN_CAP.min - 1, 2_000_000, 49_152.5]) {
      const result = SettingsConfigSchema.safeParse({
        ...baseSettings,
        defaultLenses: ["correctness"],
        effectiveCallTokenCap,
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts a null or in-range reviewWallTimeCapMs and rejects the rest", () => {
    for (const reviewWallTimeCapMs of [null, REVIEW_WALL_TIME_CAP.min, REVIEW_WALL_TIME_CAP.max]) {
      const parsed = SettingsConfigSchema.parse({
        ...baseSettings,
        defaultLenses: ["correctness"],
        reviewWallTimeCapMs,
      });
      expect(parsed.reviewWallTimeCapMs).toBe(reviewWallTimeCapMs);
    }
    for (const reviewWallTimeCapMs of [
      REVIEW_WALL_TIME_CAP.min - 1,
      REVIEW_WALL_TIME_CAP.max + 1,
      600_000.5,
    ]) {
      const result = SettingsConfigSchema.safeParse({
        ...baseSettings,
        defaultLenses: ["correctness"],
        reviewWallTimeCapMs,
      });
      expect(result.success).toBe(false);
    }
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

  it("loads settings written before the per-call token cap existed", () => {
    const { effectiveCallTokenCap: _absent, ...legacy } = DEFAULT_SETTINGS;
    const parsed = parseSettingsRecord(legacy);

    expect(parsed.settings.effectiveCallTokenCap).toBe(49_152);
    expect(parsed.diagnostics).toEqual([]);
  });

  it("salvages an out-of-range per-call token cap instead of adopting it", () => {
    const parsed = parseSettingsRecord({
      ...DEFAULT_SETTINGS,
      effectiveCallTokenCap: EFFECTIVE_CALL_TOKEN_CAP.max + 1,
    });

    expect(parsed.settings.effectiveCallTokenCap).toBe(49_152);
    expect(parsed.diagnostics).toEqual([{ field: "effectiveCallTokenCap", code: "invalid-value" }]);
  });

  it("keeps a persisted synthesis lens out of the selectable defaults", () => {
    const parsed = parseSettingsRecord({
      ...DEFAULT_SETTINGS,
      defaultLenses: ["correctness", "synthesis"],
    });

    expect(parsed.settings.defaultLenses).not.toContain("synthesis");
    expect(parsed.diagnostics).toEqual([{ field: "defaultLenses", code: "invalid-value" }]);
  });

  it("treats a provider consent recorded under another version as not given", () => {
    const accepted = parseSettingsRecord({
      ...DEFAULT_SETTINGS,
      providerConsent: acceptProviderConsent("2026-08-18T10:00:00.000Z"),
    });
    expect(accepted.settings.providerConsent).toEqual({
      version: 1,
      acceptedAt: "2026-08-18T10:00:00.000Z",
    });

    const outdated = parseSettingsRecord({
      ...DEFAULT_SETTINGS,
      providerConsent: { version: 0, acceptedAt: "2026-08-18T10:00:00.000Z" },
    });
    expect(outdated.settings.providerConsent).toBeNull();
    expect(outdated.diagnostics).toEqual([{ field: "providerConsent", code: "invalid-value" }]);
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

describe("parseEffectiveCallTokenCap", () => {
  it("accepts whole numbers inside the range, ignoring surrounding whitespace", () => {
    expect(parseEffectiveCallTokenCap(" 49152 ")).toBe(49_152);
    expect(parseEffectiveCallTokenCap(String(EFFECTIVE_CALL_TOKEN_CAP.min))).toBe(
      EFFECTIVE_CALL_TOKEN_CAP.min,
    );
    expect(parseEffectiveCallTokenCap(String(EFFECTIVE_CALL_TOKEN_CAP.max))).toBe(
      EFFECTIVE_CALL_TOKEN_CAP.max,
    );
  });

  it("rejects anything that is not a plain in-range integer", () => {
    expect(parseEffectiveCallTokenCap("1e5")).toBeNull();
    expect(parseEffectiveCallTokenCap("0x10000")).toBeNull();
    expect(parseEffectiveCallTokenCap("49152.5")).toBeNull();
    expect(parseEffectiveCallTokenCap("")).toBeNull();
    expect(parseEffectiveCallTokenCap(String(EFFECTIVE_CALL_TOKEN_CAP.min - 1))).toBeNull();
    expect(parseEffectiveCallTokenCap(String(EFFECTIVE_CALL_TOKEN_CAP.max + 1))).toBeNull();
  });
});
