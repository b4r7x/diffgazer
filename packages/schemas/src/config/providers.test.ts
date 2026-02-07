import { describe, it, expect } from "vitest";
import { UserConfigSchema } from "./providers.js";

const now = new Date().toISOString();
const baseConfig = {
  provider: "gemini" as const,
  createdAt: now,
  updatedAt: now,
};

describe("UserConfigSchema refine — model/provider validation", () => {
  it("accepts valid gemini model for gemini provider", () => {
    const result = UserConfigSchema.safeParse({
      ...baseConfig,
      model: "gemini-2.5-flash",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid model for gemini provider", () => {
    const result = UserConfigSchema.safeParse({
      ...baseConfig,
      model: "glm-4.7",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid GLM model for zai provider", () => {
    const result = UserConfigSchema.safeParse({
      ...baseConfig,
      provider: "zai",
      model: "glm-4.7",
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid GLM model for zai-coding provider", () => {
    const result = UserConfigSchema.safeParse({
      ...baseConfig,
      provider: "zai-coding",
      model: "glm-4.7",
    });

    expect(result.success).toBe(true);
  });

  it("accepts any model for openrouter provider", () => {
    const result = UserConfigSchema.safeParse({
      ...baseConfig,
      provider: "openrouter",
      model: "any-model-id/whatever",
    });

    expect(result.success).toBe(true);
  });

  it("accepts config without model (optional)", () => {
    const result = UserConfigSchema.safeParse({
      ...baseConfig,
    });

    expect(result.success).toBe(true);
  });
});
