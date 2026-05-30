import { describe, it, expect } from "vitest";
import { UserConfigSchema } from "./providers";

const now = new Date().toISOString();
const baseConfig = {
  provider: "gemini" as const,
  createdAt: now,
  updatedAt: now,
};

describe("UserConfigSchema refine — model/provider validation", () => {
  it.each<{
    name: string;
    overrides: Record<string, unknown>;
    success: boolean;
  }>([
    {
      name: "gemini provider with valid gemini model",
      overrides: { model: "gemini-2.5-flash" },
      success: true,
    },
    {
      name: "gemini provider with non-gemini model",
      overrides: { model: "glm-4.7" },
      success: false,
    },
    {
      name: "zai provider with GLM model",
      overrides: { provider: "zai", model: "glm-4.7" },
      success: true,
    },
    {
      name: "zai-coding provider with GLM model",
      overrides: { provider: "zai-coding", model: "glm-4.7" },
      success: true,
    },
    {
      name: "openrouter provider with arbitrary model id",
      overrides: { provider: "openrouter", model: "any-model-id/whatever" },
      success: true,
    },
    {
      name: "any provider with model omitted",
      overrides: {},
      success: true,
    },
  ])("$name → success=$success", ({ overrides, success }) => {
    const result = UserConfigSchema.safeParse({ ...baseConfig, ...overrides });

    expect(result.success).toBe(success);
  });
});
